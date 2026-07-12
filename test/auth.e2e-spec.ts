import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { PasswordHasherService } from '../src/common/security/password-hasher.service';
import { configureValidation } from '../src/main';
import { AppModule } from '../src/app.module';
import { LoginResponseDto } from '../src/modules/auth/dto/login-response.dto';
import { PrismaService } from '../src/prisma/prisma.service';
import { applyJwtTestEnv } from '../src/testing/jwt-test-env';

describe('AuthController (e2e)', () => {
  let app: INestApplication<App>;
  let restoreJwtTestEnv: (() => void) | undefined;
  let prisma: {
    user: { findUnique: jest.Mock; findMany: jest.Mock };
  };
  let passwordHasher: { verify: jest.Mock };
  let jwtService: JwtService;

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

    prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(activeUser),
        findMany: jest.fn().mockResolvedValue([activeUser]),
      },
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
    configureValidation(app);
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

  it('POST /auth/login returns an access token only for valid active credentials', async () => {
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
});
