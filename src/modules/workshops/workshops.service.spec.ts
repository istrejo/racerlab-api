import { ConflictException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { WorkshopsService } from './workshops.service';

describe('WorkshopsService ownership', () => {
  const user = {
    id: '2f1b7652-92f6-4a32-863f-26b5af5e0c12',
    email: 'owner@example.com',
    isActive: true as const,
    mustChangePassword: false,
    sessionId: '66e37e48-b2df-4de4-b726-56c958403c8e',
    membershipId: '77f5a70c-936a-4d17-a4d2-cc4773b8a5ec',
    workshopId: 'e79033dc-7d16-421f-ae1a-d216f9a306d7',
    role: UserRole.OWNER,
  };
  const authService = {
    activateMembershipForSession: jest
      .fn()
      .mockResolvedValue({ accessToken: 'new-token' }),
  };
  const prisma = {
    $transaction: jest.fn(),
    membership: { findFirst: jest.fn() },
  };
  let service: WorkshopsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new WorkshopsService(prisma as never, authService as never);
  });

  it('creates exactly one OWNER membership and selects it', async () => {
    const tx = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          name: 'Owner',
          isActive: true,
        }),
      },
      role: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'owner-role-id',
          name: UserRole.OWNER,
        }),
      },
      workshop: {
        create: jest.fn().mockResolvedValue({
          id: user.workshopId,
          name: 'RacerLab',
        }),
      },
      membership: {
        create: jest.fn().mockResolvedValue({
          id: user.membershipId,
          workshopId: user.workshopId,
          role: { name: UserRole.OWNER },
          workshop: { id: user.workshopId, name: 'RacerLab' },
        }),
      },
    };
    prisma.$transaction.mockImplementation(
      (callback: (client: typeof tx) => unknown) => callback(tx),
    );

    await service.create(user, { name: ' RacerLab ' });

    expect(tx.workshop.create).toHaveBeenCalledWith({
      data: {
        name: 'RacerLab',
        ownerUserId: user.id,
      },
    });
    expect(tx.membership.create).toHaveBeenCalledTimes(1);
    expect(tx.membership.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          workshopId: user.workshopId,
          userId: user.id,
          roleId: 'owner-role-id',
          displayName: 'Owner',
          isActive: true,
        },
      }),
    );
  });

  it('rejects transferring ownership to the current OWNER membership', async () => {
    await expect(
      service.transferOwnership(
        user,
        {
          workshopId: user.workshopId,
          membershipId: user.membershipId,
          role: UserRole.OWNER,
        },
        { membershipId: user.membershipId },
      ),
    ).rejects.toEqual(
      new ConflictException('This membership already owns the workshop.'),
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('promotes the target before updating the owner and demoting the previous owner', async () => {
    const targetId = '92135941-95fd-4bab-a40f-a0b3ef951c55';
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: user.workshopId }]),
      workshop: {
        findUnique: jest.fn().mockResolvedValue({ ownerUserId: user.id }),
        update: jest.fn().mockResolvedValue({}),
      },
      membership: {
        findFirst: jest.fn().mockResolvedValue({
          id: targetId,
          userId: '69c0d557-3c68-47a5-8c60-5240895df113',
          user: { isActive: true },
        }),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      role: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({ id: 'owner-role' })
          .mockResolvedValueOnce({ id: 'admin-role' }),
      },
    };
    prisma.$transaction.mockImplementation(
      (callback: (client: typeof tx) => unknown) => callback(tx),
    );
    prisma.membership.findFirst.mockResolvedValue({
      id: user.membershipId,
      workshopId: user.workshopId,
      role: { name: UserRole.ADMIN },
      workshop: { id: user.workshopId, name: 'RacerLab' },
    });

    await service.transferOwnership(
      user,
      {
        workshopId: user.workshopId,
        membershipId: user.membershipId,
        role: UserRole.OWNER,
      },
      { membershipId: targetId },
    );

    expect(tx.membership.update).toHaveBeenCalledWith({
      where: { id: targetId },
      data: {
        roleId: 'owner-role',
        isActive: true,
        deactivatedAt: null,
      },
    });
    expect(tx.membership.update.mock.invocationCallOrder[0]).toBeLessThan(
      tx.workshop.update.mock.invocationCallOrder[0],
    );
    expect(tx.workshop.update.mock.invocationCallOrder[0]).toBeLessThan(
      tx.membership.updateMany.mock.invocationCallOrder[0],
    );
  });
});
