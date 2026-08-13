/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { ConflictException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { MembershipsService } from './memberships.service';

describe('MembershipsService', () => {
  const context = {
    workshopId: 'e79033dc-7d16-421f-ae1a-d216f9a306d7',
    membershipId: '6650e2ef-c46a-4fe2-875e-4af7c576e12d',
    role: UserRole.OWNER,
  };
  const now = new Date('2026-07-26T12:00:00.000Z');
  const passwordHasher = {
    hash: jest.fn().mockResolvedValue('argon2-hash'),
    verify: jest.fn(),
  };
  const prisma = {
    user: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    membership: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    authSession: { updateMany: jest.fn() },
    role: { findUnique: jest.fn() },
    $queryRaw: jest.fn(),
    $transaction: jest.fn(),
  };
  const service = new MembershipsService(prisma as never, passwordHasher);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$queryRaw.mockResolvedValue([{ id: context.workshopId }]);
    prisma.$transaction.mockImplementation(
      (callback: (tx: typeof prisma) => unknown) => callback(prisma),
    );
  });

  it('creates a global user and active membership atomically with a hash', async () => {
    const userId = '2f1b7652-92f6-4a32-863f-26b5af5e0c12';
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.role.findUnique.mockResolvedValue({
      id: 'technician-role',
      name: UserRole.TECHNICIAN,
    });
    prisma.user.create.mockResolvedValue({ id: userId });
    prisma.membership.create.mockResolvedValue({
      id: 'new-membership',
      workshopId: context.workshopId,
      displayName: 'Juan Pérez',
      phone: null,
      address: null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      role: { name: UserRole.TECHNICIAN },
      user: {
        id: userId,
        name: 'Juan Pérez',
        email: 'juan@example.com',
        isActive: true,
        mustChangePassword: true,
      },
    });

    await expect(
      service.create(context, {
        name: 'Juan Pérez',
        email: ' JUAN@EXAMPLE.COM ',
        role: UserRole.TECHNICIAN,
        password: 'temporary-secret',
      }),
    ).resolves.toMatchObject({
      name: 'Juan Pérez',
      role: UserRole.TECHNICIAN,
      isActive: true,
      user: { email: 'juan@example.com', mustChangePassword: true },
    });

    expect(passwordHasher.hash).toHaveBeenCalledWith('temporary-secret');
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: {
        name: 'Juan Pérez',
        email: 'juan@example.com',
        passwordHash: 'argon2-hash',
        isActive: true,
        mustChangePassword: true,
      },
    });
    expect(prisma.membership.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId,
          workshopId: context.workshopId,
          roleId: 'technician-role',
          isActive: true,
        }),
      }),
    );
  });

  it('rejects a globally existing email without creating or linking anything', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'existing-user' });
    prisma.role.findUnique.mockResolvedValue({
      id: 'admin-role',
      name: UserRole.ADMIN,
    });

    await expect(
      service.create(context, {
        name: 'Existing',
        email: 'existing@example.com',
        role: UserRole.ADMIN,
        password: 'temporary-secret',
      }),
    ).rejects.toEqual(new ConflictException('Email is already registered.'));
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.membership.create).not.toHaveBeenCalled();
  });

  it('always scopes membership lookup by the active workshop', async () => {
    prisma.membership.findFirst.mockResolvedValue(null);

    await expect(
      service.findOne(context, '3bc7263e-90fe-44be-8390-f01c49a3fd9f'),
    ).rejects.toEqual(new NotFoundException('Membership not found.'));
    expect(prisma.membership.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: '3bc7263e-90fe-44be-8390-f01c49a3fd9f',
          workshopId: context.workshopId,
        },
      }),
    );
  });

  it('rejects deactivating or degrading the OWNER membership', async () => {
    prisma.membership.findFirst.mockResolvedValue({
      id: context.membershipId,
      workshopId: context.workshopId,
      role: { name: UserRole.OWNER },
      user: { isActive: true },
    });

    await expect(
      service.update(context, context.membershipId, { isActive: false }),
    ).rejects.toEqual(
      new ConflictException(
        'The OWNER membership can only change through ownership transfer.',
      ),
    );
    expect(prisma.membership.update).not.toHaveBeenCalled();
  });

  it('resets a single-workshop user password and revokes all sessions', async () => {
    const targetUserId = '69c0d557-3c68-47a5-8c60-5240895df113';
    prisma.membership.findFirst.mockResolvedValue({
      id: 'target-membership',
      workshopId: context.workshopId,
      role: { name: UserRole.TECHNICIAN },
      user: { id: targetUserId, _count: { memberships: 1 } },
    });

    await service.resetPassword(
      context,
      'target-membership',
      'temporary-secret',
    );

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: targetUserId },
      data: {
        passwordHash: 'argon2-hash',
        mustChangePassword: true,
      },
    });
    expect(prisma.authSession.updateMany).toHaveBeenCalledWith({
      where: { userId: targetUserId, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('rejects password reset for a multi-workshop identity', async () => {
    prisma.membership.findFirst.mockResolvedValue({
      id: 'target-membership',
      workshopId: context.workshopId,
      role: { name: UserRole.ADMIN },
      user: { id: 'shared-user', _count: { memberships: 2 } },
    });

    await expect(
      service.resetPassword(context, 'target-membership', 'temporary-secret'),
    ).rejects.toEqual(
      new ConflictException(
        'A multi-workshop identity cannot be reset from one workshop.',
      ),
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
