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
    user: {
      create: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
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
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
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
        email: '  ADA@EXAMPLE.COM  ',
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

  it('rejects create when another row already uses the email with different casing', async () => {
    prisma.role.findUnique.mockResolvedValue({ id: 'role-1' });
    prisma.user.findFirst.mockResolvedValue({
      id: 'legacy-user',
      email: 'Ada@Example.com',
    });

    await expect(
      service.create({
        name: 'Grace Hopper',
        email: 'ada@example.com',
        password: 'super-secret',
        role: UserRole.MANAGER,
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: {
        email: {
          equals: 'ada@example.com',
          mode: 'insensitive',
        },
      },
      select: { id: true },
    });
    expect(passwordHasher.hash).not.toHaveBeenCalled();
    expect(prisma.user.create).not.toHaveBeenCalled();
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

  it('updates a user, resolves a new role, and returns a sanitized response', async () => {
    prisma.role.findUnique.mockResolvedValue({ id: 'role-2' });
    prisma.user.update.mockResolvedValue({
      ...storedUser,
      name: 'Grace Hopper',
      email: 'grace@example.com',
      roleId: 'role-2',
      role: { name: UserRole.MANAGER },
      isActive: false,
    });

    await expect(
      service.update(storedUser.id, {
        name: 'Grace Hopper',
        email: '  GRACE@EXAMPLE.COM  ',
        role: UserRole.MANAGER,
        isActive: false,
      }),
    ).resolves.toEqual({
      id: storedUser.id,
      name: 'Grace Hopper',
      email: 'grace@example.com',
      role: UserRole.MANAGER,
      isActive: false,
      createdAt,
      updatedAt,
    });

    expect(prisma.role.findUnique).toHaveBeenCalledWith({
      where: { name: UserRole.MANAGER },
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: storedUser.id },
      data: {
        name: 'Grace Hopper',
        email: 'grace@example.com',
        roleId: 'role-2',
        isActive: false,
      },
      include: { role: true },
    });
  });

  it('updates a user without role lookup when the role does not change', async () => {
    prisma.user.update.mockResolvedValue({
      ...storedUser,
      name: 'Ada Byron',
    });

    await expect(
      service.update(storedUser.id, {
        name: 'Ada Byron',
      }),
    ).resolves.toEqual({
      id: storedUser.id,
      name: 'Ada Byron',
      email: storedUser.email,
      role: UserRole.ADMIN,
      isActive: true,
      createdAt,
      updatedAt,
    });

    expect(prisma.role.findUnique).not.toHaveBeenCalled();
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: storedUser.id },
      data: {
        name: 'Ada Byron',
      },
      include: { role: true },
    });
  });

  it('rejects duplicate updated emails with a conflict exception', async () => {
    prisma.user.update.mockRejectedValue({ code: 'P2002' });

    await expect(
      service.update(storedUser.id, {
        email: 'ada@example.com',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects update when another row already uses the email with different casing', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'legacy-user' });

    await expect(
      service.update(storedUser.id, {
        email: 'ADA@example.com',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: {
        email: {
          equals: 'ada@example.com',
          mode: 'insensitive',
        },
        NOT: { id: storedUser.id },
      },
      select: { id: true },
    });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('allows update when the matching case-insensitive email belongs to the same user id', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.update.mockResolvedValue(storedUser);

    await expect(
      service.update(storedUser.id, {
        email: 'ADA@example.com',
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

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: {
        email: {
          equals: 'ada@example.com',
          mode: 'insensitive',
        },
        NOT: { id: storedUser.id },
      },
      select: { id: true },
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: storedUser.id },
      data: {
        email: 'ada@example.com',
      },
      include: { role: true },
    });
  });

  it('throws not found when updating a missing user', async () => {
    prisma.user.update.mockRejectedValue({ code: 'P2025' });

    await expect(
      service.update(storedUser.id, {
        name: 'Missing User',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('fails explicitly when the requested update role is missing', async () => {
    prisma.role.findUnique.mockResolvedValue(null);

    await expect(
      service.update(storedUser.id, {
        role: UserRole.TECHNICIAN,
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
