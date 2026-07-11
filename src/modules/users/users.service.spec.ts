import {
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: {
    role: { findUnique: jest.Mock };
    user: { create: jest.Mock; findMany: jest.Mock; findUnique: jest.Mock };
  };
  let passwordHasher: { hash: jest.Mock };

  const createdAt = new Date('2026-07-10T12:00:00.000Z');
  const updatedAt = new Date('2026-07-10T12:30:00.000Z');

  const storedUser = {
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

  beforeEach(() => {
    prisma = {
      role: { findUnique: jest.fn() },
      user: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
    };
    passwordHasher = { hash: jest.fn() };
    service = new UsersService(
      prisma as unknown as PrismaService,
      passwordHasher,
    );
  });

  it('creates a user with a hashed password and returns a sanitized response', async () => {
    prisma.role.findUnique.mockResolvedValue({ id: 'role-1' });
    passwordHasher.hash.mockResolvedValue('hashed-password');
    prisma.user.create.mockResolvedValue(storedUser);

    await expect(
      service.create({
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        password: 'super-secret',
        role: UserRole.ADMIN,
      }),
    ).resolves.toEqual({
      id: storedUser.id,
      name: storedUser.name,
      email: storedUser.email,
      role: UserRole.ADMIN,
      isActive: true,
      createdAt,
      updatedAt,
    });

    expect(passwordHasher.hash).toHaveBeenCalledWith('super-secret');
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: {
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        passwordHash: 'hashed-password',
        roleId: 'role-1',
        isActive: true,
      },
      include: { role: true },
    });
  });

  it('rejects duplicate emails with a conflict exception', async () => {
    prisma.role.findUnique.mockResolvedValue({ id: 'role-1' });
    passwordHasher.hash.mockResolvedValue('hashed-password');
    prisma.user.create.mockRejectedValue({ code: 'P2002' });

    await expect(
      service.create({
        name: 'Grace Hopper',
        email: 'ada@example.com',
        password: 'super-secret',
        role: UserRole.MANAGER,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('fails explicitly when the requested bootstrap role is missing', async () => {
    prisma.role.findUnique.mockResolvedValue(null);

    await expect(
      service.create({
        name: 'Linus Torvalds',
        email: 'linus@example.com',
        password: 'super-secret',
        role: UserRole.TECHNICIAN,
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('lists users as sanitized resources ordered by newest first', async () => {
    prisma.user.findMany.mockResolvedValue([storedUser]);

    await expect(service.findAll()).resolves.toEqual([
      {
        id: storedUser.id,
        name: storedUser.name,
        email: storedUser.email,
        role: UserRole.ADMIN,
        isActive: true,
        createdAt,
        updatedAt,
      },
    ]);
    expect(prisma.user.findMany).toHaveBeenCalledWith({
      include: { role: true },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('returns a sanitized user detail by id', async () => {
    prisma.user.findUnique.mockResolvedValue(storedUser);

    await expect(service.findOne(storedUser.id)).resolves.toEqual({
      id: storedUser.id,
      name: storedUser.name,
      email: storedUser.email,
      role: UserRole.ADMIN,
      isActive: true,
      createdAt,
      updatedAt,
    });
  });

  it('throws not found when user detail does not exist', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.findOne(storedUser.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
