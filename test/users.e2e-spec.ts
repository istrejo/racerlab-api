import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { PasswordHasherService } from '../src/common/security/password-hasher.service';
import { configureValidation } from '../src/main';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { applyJwtTestEnv } from '../src/testing/jwt-test-env';

describe('UsersController (e2e)', () => {
  let app: INestApplication<App>;
  let restoreJwtTestEnv: (() => void) | undefined;
  let jwtService: JwtService;
  let prisma: {
    role: { findUnique: jest.Mock };
    user: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };
  let passwordHasher: { hash: jest.Mock };

  const createdAt = new Date('2026-07-10T12:00:00.000Z');
  const updatedAt = new Date('2026-07-10T12:30:00.000Z');
  const user = {
    id: '2f1b7652-92f6-4a32-863f-26b5af5e0c12',
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    passwordHash: 'hashed-password',
    roleId: 'role-1',
    role: { name: UserRole.ADMIN },
    isActive: true,
    createdAt,
    updatedAt,
  };
  const managerUser = {
    ...user,
    role: { name: UserRole.MANAGER },
  };

  beforeEach(async () => {
    restoreJwtTestEnv = applyJwtTestEnv();

    prisma = {
      role: { findUnique: jest.fn().mockResolvedValue({ id: 'role-1' }) },
      user: {
        create: jest.fn().mockResolvedValue(user),
        findMany: jest.fn().mockResolvedValue([user]),
        findUnique: jest.fn().mockResolvedValue(user),
        update: jest.fn().mockResolvedValue({
          ...user,
          name: 'Grace Hopper',
          email: 'grace@example.com',
          role: { name: UserRole.MANAGER },
          isActive: false,
        }),
      },
    };
    passwordHasher = { hash: jest.fn().mockResolvedValue('hashed-password') };

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

  async function signAccessToken(subject = user.id): Promise<string> {
    return jwtService.signAsync({ sub: subject });
  }

  async function createAdminAuthorizationHeader(): Promise<string> {
    return `Bearer ${await signAccessToken()}`;
  }

  it.each([
    [
      'POST /users',
      'post',
      '/users',
      {
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        password: 'super-secret',
        role: UserRole.ADMIN,
      },
    ],
    ['GET /users', 'get', '/users', undefined],
    ['GET /users/:id', 'get', `/users/${user.id}`, undefined],
    [
      'PATCH /users/:id',
      'patch',
      `/users/${user.id}`,
      { name: 'Grace Hopper' },
    ],
  ] as const)(
    '%s rejects anonymous requests with 401',
    async (_label, method, url, body) => {
      const httpRequest = request(app.getHttpServer())[method](url);

      if (body) {
        httpRequest.send(body);
      }

      await httpRequest.expect(401);
    },
  );

  it.each([
    [
      'POST /users',
      'post',
      '/users',
      {
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        password: 'super-secret',
        role: UserRole.ADMIN,
      },
    ],
    ['GET /users', 'get', '/users', undefined],
    ['GET /users/:id', 'get', `/users/${user.id}`, undefined],
    [
      'PATCH /users/:id',
      'patch',
      `/users/${user.id}`,
      { name: 'Grace Hopper' },
    ],
  ] as const)(
    '%s rejects authenticated non-ADMIN requests with 403',
    async (_label, method, url, body) => {
      const accessToken = await signAccessToken();
      prisma.user.findUnique.mockResolvedValueOnce(managerUser);
      const httpRequest = request(app.getHttpServer())
        [method](url)
        .set('Authorization', `Bearer ${accessToken}`);

      if (body) {
        httpRequest.send(body);
      }

      await httpRequest.expect(403);
    },
  );

  it('POST /users allows an authenticated ADMIN request and returns a sanitized response', async () => {
    const accessToken = await signAccessToken();

    const response = await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        password: 'super-secret',
        role: UserRole.ADMIN,
      })
      .expect(201);

    expect(response.body).toEqual({
      id: user.id,
      name: user.name,
      email: user.email,
      role: UserRole.ADMIN,
      isActive: true,
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
    });
    expect(response.body).not.toHaveProperty('passwordHash');
    expect(response.body).not.toHaveProperty('roleId');
  });

  it('GET /users allows an authenticated ADMIN request and returns sanitized user responses', async () => {
    const accessToken = await signAccessToken();

    const response = await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body).toEqual([
      {
        id: user.id,
        name: user.name,
        email: user.email,
        role: UserRole.ADMIN,
        isActive: true,
        createdAt: createdAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
      },
    ]);
  });

  it('GET /users/:id allows an authenticated ADMIN request and returns a sanitized user response', async () => {
    const accessToken = await signAccessToken();

    const response = await request(app.getHttpServer())
      .get(`/users/${user.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body).toEqual({
      id: user.id,
      name: user.name,
      email: user.email,
      role: UserRole.ADMIN,
      isActive: true,
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
    });
  });

  it('PATCH /users/:id allows an authenticated ADMIN request and returns a sanitized user response', async () => {
    const accessToken = await signAccessToken();

    const response = await request(app.getHttpServer())
      .patch(`/users/${user.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Grace Hopper',
        email: 'grace@example.com',
        role: UserRole.MANAGER,
        isActive: false,
      })
      .expect(200);

    expect(response.body).toEqual({
      id: user.id,
      name: 'Grace Hopper',
      email: 'grace@example.com',
      role: UserRole.MANAGER,
      isActive: false,
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
    });
    expect(response.body).not.toHaveProperty('passwordHash');
    expect(response.body).not.toHaveProperty('roleId');
  });

  it('POST /users rejects invalid bodies', async () => {
    const authorization = await createAdminAuthorizationHeader();

    await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', authorization)
      .send({
        name: '',
        email: 'not-an-email',
        password: 'short',
        role: 'OWNER',
        extra: 'not allowed',
      })
      .expect(400);
  });

  it('GET /users/:id rejects invalid UUIDs', async () => {
    const authorization = await createAdminAuthorizationHeader();

    await request(app.getHttpServer())
      .get('/users/not-a-uuid')
      .set('Authorization', authorization)
      .expect(400);
  });

  it('PATCH /users/:id rejects invalid bodies', async () => {
    const authorization = await createAdminAuthorizationHeader();

    await request(app.getHttpServer())
      .patch(`/users/${user.id}`)
      .set('Authorization', authorization)
      .send({
        name: '',
        email: 'not-an-email',
        role: 'OWNER',
        password: 'not allowed',
        extra: 'not allowed',
      })
      .expect(400);
  });

  it('PATCH /users/:id rejects invalid UUIDs', async () => {
    const authorization = await createAdminAuthorizationHeader();

    await request(app.getHttpServer())
      .patch('/users/not-a-uuid')
      .set('Authorization', authorization)
      .send({ name: 'Grace Hopper' })
      .expect(400);
  });

  it('POST /users rejects duplicate emails', async () => {
    prisma.user.create.mockRejectedValueOnce({ code: 'P2002' });
    const authorization = await createAdminAuthorizationHeader();

    await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', authorization)
      .send({
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        password: 'super-secret',
        role: UserRole.ADMIN,
      })
      .expect(409);
  });

  it('GET /users/:id returns not found for a missing user', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce(user)
      .mockResolvedValueOnce(null);
    const authorization = await createAdminAuthorizationHeader();

    await request(app.getHttpServer())
      .get(`/users/${user.id}`)
      .set('Authorization', authorization)
      .expect(404);
  });

  it('PATCH /users/:id rejects duplicate emails', async () => {
    prisma.user.update.mockRejectedValueOnce({ code: 'P2002' });
    const authorization = await createAdminAuthorizationHeader();

    await request(app.getHttpServer())
      .patch(`/users/${user.id}`)
      .set('Authorization', authorization)
      .send({ email: 'grace@example.com' })
      .expect(409);
  });

  it('PATCH /users/:id returns not found for a missing user', async () => {
    prisma.user.update.mockRejectedValueOnce({ code: 'P2025' });
    const authorization = await createAdminAuthorizationHeader();

    await request(app.getHttpServer())
      .patch(`/users/${user.id}`)
      .set('Authorization', authorization)
      .send({ name: 'Grace Hopper' })
      .expect(404);
  });

  it('PATCH /users/:id returns service unavailable when the requested role is missing', async () => {
    prisma.role.findUnique.mockResolvedValueOnce(null);
    const authorization = await createAdminAuthorizationHeader();

    await request(app.getHttpServer())
      .patch(`/users/${user.id}`)
      .set('Authorization', authorization)
      .send({ role: UserRole.TECHNICIAN })
      .expect(503);
  });
});
