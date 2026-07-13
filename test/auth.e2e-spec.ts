import { createHash } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { PasswordHasherService } from '../src/common/security/password-hasher.service';
import { configureApp } from '../src/main';
import { AppModule } from '../src/app.module';
import { LoginResponseDto } from '../src/modules/auth/dto/login-response.dto';
import { PrismaService } from '../src/prisma/prisma.service';
import { applyJwtTestEnv } from '../src/testing/jwt-test-env';

type RefreshResponseBody = LoginResponseDto;

type PersistedSession = {
  id: string;
  userId: string;
  tokenFamilyId: string;
  tokenHash: string;
  expiresAt: Date;
  consumedAt: Date | null;
  revokedAt: Date | null;
  replacedBySessionId: string | null;
  createdUserAgent?: string | null;
  createdIp?: string | null;
  lastUsedUserAgent?: string | null;
  lastUsedIp?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function extractRefreshCookie(setCookieHeader: string[] | undefined): string {
  const refreshCookie = setCookieHeader?.find((entry) =>
    entry.startsWith('rl_refresh='),
  );

  expect(refreshCookie).toBeDefined();

  return refreshCookie!.split(';', 1)[0];
}

describe('AuthController (e2e)', () => {
  let app: INestApplication<App>;
  let restoreJwtTestEnv: (() => void) | undefined;
  let prisma: {
    user: { findUnique: jest.Mock; findMany: jest.Mock };
    authSession: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let passwordHasher: { verify: jest.Mock };
  let jwtService: JwtService;
  let sessionCounter = 0;
  let sessionsByHash: Map<string, PersistedSession>;

  const activeUser = {
    id: '2f1b7652-92f6-4a32-863f-26b5af5e0c12',
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    passwordHash: 'hashed-password',
    roleId: 'role-1',
    role: { name: UserRole.ADMIN },
    isActive: true,
    createdAt: new Date('2026-07-11T18:00:00.000Z'),
    updatedAt: new Date('2026-07-11T18:00:00.000Z'),
  };

  beforeEach(async () => {
    restoreJwtTestEnv = applyJwtTestEnv({
      JWT_SECRET: 'integration-secret',
      JWT_ACCESS_TOKEN_TTL: '15m',
    });

    sessionsByHash = new Map<string, PersistedSession>();
    sessionCounter = 0;

    prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(activeUser),
        findMany: jest.fn().mockResolvedValue([activeUser]),
      },
      authSession: {
        create: jest.fn().mockImplementation(({ data }: { data: PersistedSession }) => {
          sessionCounter += 1;
          const persisted: PersistedSession = {
            id: `session-${sessionCounter}`,
            userId: data.userId,
            tokenFamilyId: data.tokenFamilyId,
            tokenHash: data.tokenHash,
            expiresAt: data.expiresAt,
            consumedAt: null,
            revokedAt: null,
            replacedBySessionId: null,
            createdUserAgent: data.createdUserAgent ?? null,
            createdIp: data.createdIp ?? null,
            lastUsedUserAgent: data.lastUsedUserAgent ?? null,
            lastUsedIp: data.lastUsedIp ?? null,
            createdAt: new Date('2026-07-13T12:00:00.000Z'),
            updatedAt: new Date('2026-07-13T12:00:00.000Z'),
          };

          sessionsByHash.set(persisted.tokenHash, persisted);

          return persisted;
        }),
        findUnique: jest.fn().mockImplementation(({ where }: { where: { tokenHash: string } }) => {
          const session = sessionsByHash.get(where.tokenHash);

          if (!session) {
            return null;
          }

          return {
            ...session,
            user: activeUser,
          };
        }),
        update: jest.fn().mockImplementation(({ where, data }: { where: { id: string }; data: Partial<PersistedSession> }) => {
          const session = [...sessionsByHash.values()].find(
            (candidate) => candidate.id === where.id,
          );

          if (!session) {
            throw new Error(`Unknown session ${where.id}`);
          }

          Object.assign(session, data, {
            updatedAt: new Date('2026-07-13T12:05:00.000Z'),
          });

          return {
            ...session,
            user: activeUser,
          };
        }),
        updateMany: jest.fn().mockImplementation(({ where, data }: { where: Partial<PersistedSession> & { expiresAt?: { gt: Date } }; data: Partial<PersistedSession> }) => {
          let count = 0;

          for (const session of sessionsByHash.values()) {
            if (where.id) {
              if (
                session.id === where.id &&
                session.consumedAt === (where.consumedAt ?? session.consumedAt) &&
                session.revokedAt === (where.revokedAt ?? session.revokedAt) &&
                (!where.expiresAt || session.expiresAt.getTime() > where.expiresAt.gt.getTime())
              ) {
                Object.assign(session, data, {
                  updatedAt: new Date('2026-07-13T12:06:00.000Z'),
                });
                count += 1;
              }

              continue;
            }

            if (where.userId) {
              if (
                session.userId === where.userId &&
                session.revokedAt === (where.revokedAt ?? session.revokedAt) &&
                (!where.expiresAt || session.expiresAt.getTime() > where.expiresAt.gt.getTime())
              ) {
                Object.assign(session, data, {
                  updatedAt: new Date('2026-07-13T12:06:00.000Z'),
                });
                count += 1;
              }

              continue;
            }

            if (
              session.tokenFamilyId === where.tokenFamilyId &&
              session.revokedAt === where.revokedAt
            ) {
              Object.assign(session, data, {
                updatedAt: new Date('2026-07-13T12:06:00.000Z'),
              });
              count += 1;
            }
          }

          return { count };
        }),
      },
      $transaction: jest.fn(async (callback: (client: typeof prisma) => unknown) =>
        callback(prisma),
      ),
    };
    passwordHasher = { verify: jest.fn().mockResolvedValue(true) };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(PasswordHasherService)
      .useValue(passwordHasher)
      .compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    jwtService = app.get(JwtService);
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }

    restoreJwtTestEnv?.();
    restoreJwtTestEnv = undefined;
  });

  it('POST /auth/login returns an access token body and issues a refresh cookie for valid active credentials', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: '  ADA@EXAMPLE.COM  ',
        password: 'super-secret',
      })
      .expect(200);

    const body = response.body as LoginResponseDto;

    expect(typeof body.accessToken).toBe('string');
    expect(body.accessToken.length).toBeGreaterThan(0);
    expect(body.tokenType).toBe('Bearer');
    expect(body).not.toHaveProperty('refreshToken');
    expect(response.headers['set-cookie']).toEqual(
      expect.arrayContaining([
        expect.stringContaining('rl_refresh='),
        expect.stringContaining('HttpOnly'),
        expect.stringContaining('Path=/auth'),
      ]),
    );

    const payload = await jwtService.verifyAsync<{
      sub: string;
      iat: number;
      exp: number;
    }>(body.accessToken, {
      secret: 'integration-secret',
    });

    expect(payload.sub).toBe(activeUser.id);
    expect(payload.exp - payload.iat).toBe(900);

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'ada@example.com' },
      include: { role: true },
    });
    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: {
        email: {
          equals: 'ada@example.com',
          mode: 'insensitive',
        },
      },
      include: { role: true },
      orderBy: [{ email: 'asc' }, { id: 'asc' }],
      take: 2,
    });
    expect(passwordHasher.verify).toHaveBeenCalledWith(
      'super-secret',
      activeUser.passwordHash,
    );
  });

  it('POST /auth/login authenticates a legacy mixed-case stored email through the compatibility lookup', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null);
    prisma.user.findMany.mockResolvedValueOnce([
      {
        ...activeUser,
        email: 'Ada@Example.com',
      },
    ]);

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: '  ADA@EXAMPLE.COM  ',
        password: 'super-secret',
      })
      .expect(200);

    const body = response.body as LoginResponseDto;

    expect(typeof body.accessToken).toBe('string');
    expect(body.accessToken.length).toBeGreaterThan(0);
    expect(body.tokenType).toBe('Bearer');
    expect(response.headers['set-cookie']).toEqual(
      expect.arrayContaining([expect.stringContaining('rl_refresh=')]),
    );

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: {
        email: {
          equals: 'ada@example.com',
          mode: 'insensitive',
        },
      },
      include: { role: true },
      orderBy: [{ email: 'asc' }, { id: 'asc' }],
      take: 2,
    });
  });

  it.each([
    {
      caseName: 'unknown credentials',
      arrange: () => {
        prisma.user.findUnique.mockResolvedValueOnce(null);
        prisma.user.findMany.mockResolvedValueOnce([]);
      },
    },
    {
      caseName: 'inactive credentials',
      arrange: () => {
        prisma.user.findUnique.mockResolvedValueOnce({
          ...activeUser,
          isActive: false,
        });
      },
    },
    {
      caseName: 'wrong password credentials',
      arrange: () => {
        passwordHasher.verify.mockResolvedValueOnce(false);
      },
    },
  ])('POST /auth/login returns the same 401 for %s', async ({ arrange }) => {
    arrange();

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'ada@example.com',
        password: 'wrong-secret',
      })
      .expect(401);

    expect(response.body).toEqual({
      statusCode: 401,
      message: 'Invalid credentials.',
      error: 'Unauthorized',
    });
  });

  it('POST /auth/login fails closed when lowercase and legacy mixed-case duplicates coexist', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(activeUser);
    prisma.user.findMany.mockResolvedValueOnce([
      activeUser,
      {
        ...activeUser,
        id: 'duplicate-user',
        email: 'Ada@Example.com',
      },
    ]);

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'ada@example.com',
        password: 'super-secret',
      })
      .expect(401);

    expect(response.body).toEqual({
      statusCode: 401,
      message: 'Invalid credentials.',
      error: 'Unauthorized',
    });
    expect(passwordHasher.verify).not.toHaveBeenCalled();
  });

  it('POST /auth/login returns 503 when an internal auth dependency fails', async () => {
    prisma.user.findUnique.mockRejectedValueOnce(new Error('database offline'));

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'ada@example.com',
        password: 'super-secret',
      })
      .expect(503);

    expect(response.body).toEqual({
      statusCode: 503,
      message: 'Authentication service temporarily unavailable.',
      error: 'Service Unavailable',
    });
  });

  it('POST /auth/refresh rotates the refresh cookie and returns a fresh access token', async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'ada@example.com',
        password: 'super-secret',
      })
      .expect(200);

    const initialCookie = extractRefreshCookie(loginResponse.headers['set-cookie']);

    const refreshResponse = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', initialCookie)
      .expect(200);

    const body = refreshResponse.body as RefreshResponseBody;
    const rotatedCookie = extractRefreshCookie(refreshResponse.headers['set-cookie']);

    expect(body.tokenType).toBe('Bearer');
    expect(body).not.toHaveProperty('refreshToken');
    expect(rotatedCookie).not.toBe(initialCookie);

    const payload = await jwtService.verifyAsync<{
      sub: string;
      iat: number;
      exp: number;
    }>(body.accessToken, {
      secret: 'integration-secret',
    });

    expect(payload.sub).toBe(activeUser.id);
    expect(payload.exp - payload.iat).toBe(900);
  });

  it('POST /auth/refresh accepts only one concurrent use of the same refresh cookie', async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'ada@example.com',
        password: 'super-secret',
      })
      .expect(200);

    const initialCookie = extractRefreshCookie(loginResponse.headers['set-cookie']);

    const responses = await Promise.all([
      request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', initialCookie)
        .set('User-Agent', 'Concurrent Client'),
      request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', initialCookie)
        .set('User-Agent', 'Concurrent Client'),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([200, 401]);
    expect(prisma.authSession.updateMany).toHaveBeenCalledWith({
      where: {
        id: expect.any(String),
        consumedAt: null,
        revokedAt: null,
        expiresAt: { gt: expect.any(Date) },
      },
      data: {
        consumedAt: expect.any(Date),
        lastUsedUserAgent: expect.any(String),
        lastUsedIp: expect.any(String),
      },
    });
  });

  it('POST /auth/refresh returns the same generic 401 for missing and replayed refresh state', async () => {
    await request(app.getHttpServer()).post('/auth/refresh').expect(401);

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'ada@example.com',
        password: 'super-secret',
      })
      .expect(200);

    const originalCookie = extractRefreshCookie(loginResponse.headers['set-cookie']);

    const firstRefresh = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', originalCookie)
      .expect(200);

    const rotatedCookie = extractRefreshCookie(firstRefresh.headers['set-cookie']);

    const replayedResponse = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', originalCookie)
      .expect(401);

    expect(replayedResponse.body).toEqual({
      statusCode: 401,
      message: 'Invalid refresh session.',
      error: 'Unauthorized',
    });

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', rotatedCookie)
      .expect(401);
  });

  it('POST /auth/refresh keeps concurrent sessions independent', async () => {
    const loginResponseA = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'ada@example.com',
        password: 'super-secret',
      })
      .set('User-Agent', 'Workshop iPad')
      .expect(200);

    const loginResponseB = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'ada@example.com',
        password: 'super-secret',
      })
      .set('User-Agent', 'Front Desk Chrome')
      .expect(200);

    const cookieA = extractRefreshCookie(loginResponseA.headers['set-cookie']);
    const cookieB = extractRefreshCookie(loginResponseB.headers['set-cookie']);

    const refreshedA = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', cookieA)
      .set('User-Agent', 'Workshop iPad')
      .expect(200);

    extractRefreshCookie(refreshedA.headers['set-cookie']);

    const refreshedB = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', cookieB)
      .set('User-Agent', 'Front Desk Chrome')
      .expect(200);

    expect(refreshedB.body).toMatchObject({ tokenType: 'Bearer' });
  });

  it('POST /auth/logout revokes only the current refresh session and clears the cookie', async () => {
    const loginResponseA = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'ada@example.com',
        password: 'super-secret',
      })
      .set('User-Agent', 'Workshop iPad')
      .expect(200);

    const loginResponseB = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'ada@example.com',
        password: 'super-secret',
      })
      .set('User-Agent', 'Front Desk Chrome')
      .expect(200);

    const cookieA = extractRefreshCookie(loginResponseA.headers['set-cookie']);
    const cookieB = extractRefreshCookie(loginResponseB.headers['set-cookie']);

    const logoutResponse = await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', cookieA)
      .set('User-Agent', 'Workshop iPad')
      .expect(204);

    expect(logoutResponse.headers['set-cookie']).toEqual(
      expect.arrayContaining([
        expect.stringContaining('rl_refresh='),
        expect.stringContaining('HttpOnly'),
        expect.stringContaining('Path=/auth'),
      ]),
    );

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', cookieA)
      .expect(401);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', cookieB)
      .set('User-Agent', 'Front Desk Chrome')
      .expect(200);
  });

  it('POST /auth/logout stays state-neutral and clears the cookie even without a current refresh session', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/logout')
      .expect(204);

    expect(response.headers['set-cookie']).toEqual(
      expect.arrayContaining([
        expect.stringContaining('rl_refresh='),
        expect.stringContaining('HttpOnly'),
        expect.stringContaining('Path=/auth'),
      ]),
    );
  });

  it('POST /auth/logout-all requires bearer authentication', async () => {
    await request(app.getHttpServer()).post('/auth/logout-all').expect(401);
  });

  it('POST /auth/logout-all revokes every active refresh session for the authenticated user', async () => {
    const loginResponseA = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'ada@example.com',
        password: 'super-secret',
      })
      .set('User-Agent', 'Workshop iPad')
      .expect(200);

    const loginResponseB = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'ada@example.com',
        password: 'super-secret',
      })
      .set('User-Agent', 'Front Desk Chrome')
      .expect(200);

    const cookieA = extractRefreshCookie(loginResponseA.headers['set-cookie']);
    const cookieB = extractRefreshCookie(loginResponseB.headers['set-cookie']);
    const accessToken = (loginResponseA.body as LoginResponseDto).accessToken;

    const response = await request(app.getHttpServer())
      .post('/auth/logout-all')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Cookie', cookieA)
      .expect(204);

    expect(response.headers['set-cookie']).toEqual(
      expect.arrayContaining([
        expect.stringContaining('rl_refresh='),
        expect.stringContaining('HttpOnly'),
        expect.stringContaining('Path=/auth'),
      ]),
    );

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', cookieA)
      .expect(401);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', cookieB)
      .expect(401);
  });
});
