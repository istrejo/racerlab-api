/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PasswordHasherService } from '../src/common/security/password-hasher.service';
import { configureApp } from '../src/main';
import { PrismaService } from '../src/prisma/prisma.service';
import { applyJwtTestEnv } from '../src/testing/jwt-test-env';

type SessionRecord = {
  id: string;
  userId: string;
  activeMembershipId: string | null;
  expiresAt: Date;
  revokedAt: Date | null;
  lastUsedUserAgent: string | null;
  lastUsedIp: string | null;
};

type RefreshTokenRecord = {
  id: string;
  sessionId: string;
  expiresAt: Date;
  consumedAt: Date | null;
  revokedAt: Date | null;
  replacedByTokenId: string | null;
};

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

function tokenIdFromCookie(cookie: string): string {
  return cookie.slice(cookie.indexOf('=') + 1).split('.', 1)[0];
}

describe('Auth refresh rotation (e2e)', () => {
  const userId = '2f1b7652-92f6-4a32-863f-26b5af5e0c12';
  let app: INestApplication<App>;
  let restoreJwtTestEnv: (() => void) | undefined;
  let sessions: Map<string, SessionRecord>;
  let refreshTokens: Map<string, RefreshTokenRecord>;
  let synchronizeNextRefreshLookups = false;
  let refreshLookupsWaiting = 0;
  let releaseRefreshLookups: (() => void) | undefined;

  beforeEach(async () => {
    restoreJwtTestEnv = applyJwtTestEnv({
      JWT_SECRET: 'integration-secret',
      AUTH_REFRESH_TOKEN_SECRET: 'integration-refresh-secret',
      JWT_ACCESS_TOKEN_TTL: '15m',
    });
    sessions = new Map();
    refreshTokens = new Map();
    synchronizeNextRefreshLookups = false;
    refreshLookupsWaiting = 0;
    releaseRefreshLookups = undefined;

    const user = {
      id: userId,
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      passwordHash: 'hash',
      isActive: true,
      mustChangePassword: false,
      memberships: [],
    };
    let transactionQueue = Promise.resolve<unknown>(undefined);

    const hydrateRefreshToken = (token: RefreshTokenRecord | undefined) => {
      if (!token) return null;
      const session = sessions.get(token.sessionId)!;
      const replacement = token.replacedByTokenId
        ? refreshTokens.get(token.replacedByTokenId)
        : null;
      return {
        ...token,
        replacedBy: replacement ? { ...replacement } : null,
        session: { ...session, user, activeMembership: null },
      };
    };

    const prisma = {
      user: { findMany: jest.fn().mockResolvedValue([user]) },
      authSession: {
        create: jest.fn().mockImplementation(({ data }: { data: any }) => {
          const session: SessionRecord = {
            id: data.id ?? randomUUID(),
            userId: data.userId,
            activeMembershipId: data.activeMembershipId ?? null,
            expiresAt: data.expiresAt,
            revokedAt: null,
            lastUsedUserAgent: data.lastUsedUserAgent ?? null,
            lastUsedIp: data.lastUsedIp ?? null,
          };
          const tokenData = data.refreshTokens.create;
          refreshTokens.set(tokenData.id, {
            id: tokenData.id,
            sessionId: session.id,
            expiresAt: tokenData.expiresAt,
            consumedAt: null,
            revokedAt: null,
            replacedByTokenId: null,
          });
          sessions.set(session.id, session);
          return session;
        }),
        findFirst: jest.fn().mockImplementation(({ where }: { where: any }) => {
          const session = sessions.get(where.id);
          if (
            !session ||
            session.userId !== where.userId ||
            session.revokedAt ||
            session.expiresAt <= where.expiresAt.gt
          ) {
            return null;
          }
          return { ...session, user, activeMembership: null };
        }),
        updateMany: jest
          .fn()
          .mockImplementation(({ where, data }: { where: any; data: any }) => {
            let count = 0;
            for (const session of sessions.values()) {
              if (
                (where.id && session.id !== where.id) ||
                (where.userId && session.userId !== where.userId) ||
                (where.revokedAt === null && session.revokedAt !== null) ||
                (where.expiresAt && session.expiresAt <= where.expiresAt.gt)
              ) {
                continue;
              }
              Object.assign(session, data);
              count += 1;
            }
            return { count };
          }),
      },
      refreshToken: {
        findUnique: jest
          .fn()
          .mockImplementation(async ({ where }: { where: { id: string } }) => {
            if (synchronizeNextRefreshLookups) {
              refreshLookupsWaiting += 1;
              if (refreshLookupsWaiting === 2) {
                synchronizeNextRefreshLookups = false;
                releaseRefreshLookups?.();
              } else {
                await new Promise<void>(
                  (resolve) => (releaseRefreshLookups = resolve),
                );
              }
            }
            return hydrateRefreshToken(refreshTokens.get(where.id));
          }),
        create: jest.fn().mockImplementation(({ data }: { data: any }) => {
          const token: RefreshTokenRecord = {
            id: data.id,
            sessionId: data.sessionId,
            expiresAt: data.expiresAt,
            consumedAt: null,
            revokedAt: null,
            replacedByTokenId: null,
          };
          refreshTokens.set(token.id, token);
          return token;
        }),
        update: jest
          .fn()
          .mockImplementation(({ where, data }: { where: any; data: any }) => {
            const token = refreshTokens.get(where.id)!;
            Object.assign(token, data);
            return token;
          }),
        updateMany: jest
          .fn()
          .mockImplementation(({ where, data }: { where: any; data: any }) => {
            let count = 0;
            for (const token of refreshTokens.values()) {
              if (
                (where.id && token.id !== where.id) ||
                (where.sessionId && token.sessionId !== where.sessionId) ||
                (where.consumedAt === null && token.consumedAt !== null) ||
                (where.revokedAt === null && token.revokedAt !== null) ||
                (where.expiresAt && token.expiresAt <= where.expiresAt.gt)
              ) {
                continue;
              }
              Object.assign(token, data);
              count += 1;
            }
            return { count };
          }),
      },
      $transaction: jest.fn((callback: (tx: unknown) => unknown) => {
        const result = transactionQueue.then(() => callback(prisma));
        transactionQueue = result.then(
          () => undefined,
          () => undefined,
        );
        return result;
      }),
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

  it('returns one replacement to concurrent refreshes and revokes the session after a delayed replay', async () => {
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

    expect(refreshes.map((response) => response.status)).toEqual([200, 200]);
    const replacementCookies = refreshes.map((response) =>
      extractRefreshCookie(response.headers['set-cookie']),
    );
    expect(replacementCookies[0]).toBe(replacementCookies[1]);

    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken as string}`)
      .expect(200);

    const currentCookie = extractRefreshCookie(
      (
        await request(app.getHttpServer())
          .post('/api/auth/refresh')
          .set('Cookie', replacementCookies[0])
          .expect(200)
      ).headers['set-cookie'],
    );

    refreshTokens.get(tokenIdFromCookie(originalCookie))!.consumedAt = new Date(
      Date.now() - 5_001,
    );
    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', originalCookie)
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', currentCookie)
      .expect(401);
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken as string}`)
      .expect(401);
  });
});
