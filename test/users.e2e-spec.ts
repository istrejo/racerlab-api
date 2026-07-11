import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { PasswordHasherService } from '../src/common/security/password-hasher.service';
import { configureValidation } from '../src/main';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('UsersController (e2e)', () => {
  let app: INestApplication<App>;
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

  beforeEach(async () => {
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
  });

  afterEach(async () => {
    await app.close();
  });

  it('POST /users creates a sanitized user response', async () => {
    const response = await request(app.getHttpServer())
      .post('/users')
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

  it('GET /users lists sanitized user responses', async () => {
    const response = await request(app.getHttpServer())
      .get('/users')
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

  it('GET /users/:id returns a sanitized user response', async () => {
    const response = await request(app.getHttpServer())
      .get(`/users/${user.id}`)
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

  it('PATCH /users/:id updates a sanitized user response', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/users/${user.id}`)
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
    await request(app.getHttpServer())
      .post('/users')
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
    await request(app.getHttpServer()).get('/users/not-a-uuid').expect(400);
  });

  it('PATCH /users/:id rejects invalid bodies', async () => {
    await request(app.getHttpServer())
      .patch(`/users/${user.id}`)
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
    await request(app.getHttpServer())
      .patch('/users/not-a-uuid')
      .send({ name: 'Grace Hopper' })
      .expect(400);
  });

  it('POST /users rejects duplicate emails', async () => {
    prisma.user.create.mockRejectedValueOnce({ code: 'P2002' });

    await request(app.getHttpServer())
      .post('/users')
      .send({
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        password: 'super-secret',
        role: UserRole.ADMIN,
      })
      .expect(409);
  });

  it('GET /users/:id returns not found for a missing user', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null);

    await request(app.getHttpServer()).get(`/users/${user.id}`).expect(404);
  });

  it('PATCH /users/:id rejects duplicate emails', async () => {
    prisma.user.update.mockRejectedValueOnce({ code: 'P2002' });

    await request(app.getHttpServer())
      .patch(`/users/${user.id}`)
      .send({ email: 'grace@example.com' })
      .expect(409);
  });

  it('PATCH /users/:id returns not found for a missing user', async () => {
    prisma.user.update.mockRejectedValueOnce({ code: 'P2025' });

    await request(app.getHttpServer())
      .patch(`/users/${user.id}`)
      .send({ name: 'Grace Hopper' })
      .expect(404);
  });

  it('PATCH /users/:id returns service unavailable when the requested role is missing', async () => {
    prisma.role.findUnique.mockResolvedValueOnce(null);

    await request(app.getHttpServer())
      .patch(`/users/${user.id}`)
      .send({ role: UserRole.TECHNICIAN })
      .expect(503);
  });
});
