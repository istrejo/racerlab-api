import { createHash } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { PasswordHasherService } from '../src/common/security/password-hasher.service';
import { configureApp } from '../src/main';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { applyJwtTestEnv } from '../src/testing/jwt-test-env';

type AuthSessionRecord = {
  id: string;
  userId: string;
  activeMembershipId: string | null;
  tokenFamilyId: string;
  tokenHash: string;
  expiresAt: Date;
  consumedAt: Date | null;
  revokedAt: Date | null;
  replacedBySessionId: string | null;
  lastUsedUserAgent: string | null;
  lastUsedIp: string | null;
};

type AuthSessionData = Omit<
  AuthSessionRecord,
  | 'id'
  | 'consumedAt'
  | 'revokedAt'
  | 'replacedBySessionId'
  | 'lastUsedUserAgent'
  | 'lastUsedIp'
> & {
  id?: string;
  createdUserAgent?: string;
  createdIp?: string;
  lastUsedUserAgent?: string;
  lastUsedIp?: string;
};

function hashToken(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function extractRefreshCookie(
  setCookie: string[] | string | undefined,
): string {
  const cookies = Array.isArray(setCookie)
    ? setCookie
    : setCookie
      ? [setCookie]
      : [];
  const cookie = cookies.find((entry) => entry.startsWith('rl_refresh='));
  expect(cookie).toBeDefined();
  return cookie!.split(';', 1)[0];
}

describe('Auth refresh rotation (e2e)', () => {
  const userId = '2f1b7652-92f6-4a32-863f-26b5af5e0c12';
  let app: INestApplication<App>;
  let restoreJwtTestEnv: (() => void) | undefined;
  let synchronizeNextRefreshLookups = false;
  let refreshLookupsWaiting = 0;
  let releaseRefreshLookups: (() => void) | undefined;

  beforeEach(async () => {
    restoreJwtTestEnv = applyJwtTestEnv({
      JWT_SECRET: 'integration-secret',
      JWT_ACCESS_TOKEN_TTL: '15m',
    });

    const sessionsByHash = new Map<string, AuthSessionRecord>();
    let sessionCount = 0;
    synchronizeNextRefreshLookups = false;
    refreshLookupsWaiting = 0;
    releaseRefreshLookups = undefined;
    const user = {
      id: userId,
      email: 'ada@example.com',
      passwordHash: 'hash',
      isActive: true,
      mustChangePassword: false,
      memberships: [],
    };

    const findSession = (where: {
      id?: string;
      tokenHash?: string;
    }): AuthSessionRecord | undefined => {
      if (where.tokenHash) {
        return sessionsByHash.get(where.tokenHash);
      }

      return [...sessionsByHash.values()].find(
        (session) => session.id === where.id,
      );
    };

    const prisma = {
      user: {
        findMany: jest.fn().mockResolvedValue([user]),
      },
      authSession: {
        create: jest
          .fn()
          .mockImplementation(({ data }: { data: AuthSessionData }) => {
            const session: AuthSessionRecord = {
              id: data.id ?? `session-${++sessionCount}`,
              userId: data.userId,
              activeMembershipId: data.activeMembershipId,
              tokenFamilyId: data.tokenFamilyId,
              tokenHash: data.tokenHash,
              expiresAt: data.expiresAt,
              consumedAt: null,
              revokedAt: null,
              replacedBySessionId: null,
              lastUsedUserAgent: data.lastUsedUserAgent ?? null,
              lastUsedIp: data.lastUsedIp ?? null,
            };
            sessionsByHash.set(session.tokenHash, session);
            return session;
          }),
        findUnique: jest
          .fn()
          .mockImplementation(
            async ({
              where,
            }: {
              where: { id?: string; tokenHash?: string };
            }) => {
              const session = findSession(where);
              if (!session) {
                return null;
              }

              if (synchronizeNextRefreshLookups && where.tokenHash) {
                refreshLookupsWaiting += 1;
                if (refreshLookupsWaiting === 2) {
                  synchronizeNextRefreshLookups = false;
                  releaseRefreshLookups?.();
                } else {
                  await new Promise<void>((resolve) => {
                    releaseRefreshLookups = resolve;
                  });
                }
              }

              return {
                ...session,
                user,
                activeMembership: null,
              };
            },
          ),
        update: jest
          .fn()
          .mockImplementation(
            ({
              where,
              data,
            }: {
              where: { id: string };
              data: Partial<AuthSessionRecord>;
            }) => {
              const session = findSession(where);
              if (!session) {
                throw new Error('Session not found.');
              }
              Object.assign(session, data);
              return session;
            },
          ),
        updateMany: jest.fn().mockImplementation(
          ({
            where,
            data,
          }: {
            where: {
              id?: string;
              tokenFamilyId?: string;
              consumedAt?: null;
              revokedAt?: null;
              expiresAt?: { gt: Date };
            };
            data: Partial<AuthSessionRecord>;
          }) => {
            let count = 0;

            for (const session of sessionsByHash.values()) {
              if (
                (where.id && session.id !== where.id) ||
                (where.tokenFamilyId &&
                  session.tokenFamilyId !== where.tokenFamilyId) ||
                (where.consumedAt === null && session.consumedAt !== null) ||
                (where.revokedAt === null && session.revokedAt !== null) ||
                (where.expiresAt &&
                  session.expiresAt.getTime() <= where.expiresAt.gt.getTime())
              ) {
                continue;
              }

              Object.assign(session, data);
              count += 1;
            }

            return { count };
          },
        ),
      },
      $transaction: jest.fn((callback: (tx: unknown) => unknown) =>
        callback(prisma),
      ),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(PasswordHasherService)
      .useValue({ verify: jest.fn().mockResolvedValue(true) })
      .compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    restoreJwtTestEnv?.();
  });

  it('keeps the winning replacement usable after concurrent refresh attempts and revokes it after a later replay', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'ada@example.com', password: 'super-secret' })
      .expect(200);
    const originalCookie = extractRefreshCookie(login.headers['set-cookie']);

    synchronizeNextRefreshLookups = true;
    const refreshes = await Promise.all([
      request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', originalCookie),
      request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', originalCookie),
    ]);
    const successfulRefresh = refreshes.find(
      (response) => response.status === 200,
    );

    expect(refreshes.map((response) => response.status).sort()).toEqual([
      200, 401,
    ]);
    expect(successfulRefresh).toBeDefined();
    const winnerCookie = extractRefreshCookie(
      successfulRefresh!.headers['set-cookie'],
    );

    const winnerValidation = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', winnerCookie)
      .expect(200);
    const currentCookie = extractRefreshCookie(
      winnerValidation.headers['set-cookie'],
    );

    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', originalCookie)
      .expect(401);

    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', currentCookie)
      .expect(401);
  });
});
