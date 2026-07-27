/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import {
  BadRequestException,
  ConflictException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthService } from './auth.service';

describe('AuthService workshop sessions', () => {
  const userId = '2f1b7652-92f6-4a32-863f-26b5af5e0c12';
  const sessionId = '66e37e48-b2df-4de4-b726-56c958403c8e';
  const workshopId = 'e79033dc-7d16-421f-ae1a-d216f9a306d7';
  const membershipId = '6650e2ef-c46a-4fe2-875e-4af7c576e12d';
  const passwordHasher = {
    verify: jest.fn().mockResolvedValue(true),
    hash: jest.fn(),
  };
  const jwtService = {
    signAsync: jest.fn().mockResolvedValue('access-token'),
  };
  const authSessionService = {
    issueSession: jest.fn().mockResolvedValue({
      refreshToken: 'refresh-token',
      expiresAt: new Date('2026-08-26T00:00:00.000Z'),
      session: { id: sessionId },
    }),
    findSessionByToken: jest.fn(),
  };
  const prisma = {
    user: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    membership: { findFirst: jest.fn() },
    authSession: { updateMany: jest.fn() },
    $transaction: jest.fn(),
  };
  let service: AuthService;

  beforeAll(() => {
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.JWT_ACCESS_TOKEN_TTL = '15m';
  });

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService(
      prisma as never,
      passwordHasher,
      jwtService as never,
      authSessionService as never,
    );
  });

  it('creates a global user and neutral session in one transaction', async () => {
    passwordHasher.hash.mockResolvedValue('signup-hash');
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: userId });
    prisma.$transaction.mockImplementation(
      (callback: (tx: typeof prisma) => unknown) => callback(prisma),
    );

    await expect(
      service.signup(
        {
          name: 'Ada Lovelace',
          email: ' ADA@EXAMPLE.COM ',
          password: 'secret123',
        },
        { ipAddress: '127.0.0.1', userAgent: 'test' },
      ),
    ).resolves.toMatchObject({
      accessToken: 'access-token',
      activeWorkshop: null,
      requiresWorkshopSelection: true,
      requiresPasswordChange: false,
    });
    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: {
        email: {
          equals: 'ada@example.com',
          mode: 'insensitive',
        },
      },
      select: { id: true },
    });
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: {
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        passwordHash: 'signup-hash',
        isActive: true,
        mustChangePassword: false,
      },
      select: { id: true },
    });
    expect(authSessionService.issueSession).toHaveBeenCalledWith(
      expect.objectContaining({
        prisma,
        userId,
        activeMembershipId: undefined,
      }),
    );
  });

  it('rejects a signup email that already belongs to a global identity', async () => {
    passwordHasher.hash.mockResolvedValue('signup-hash');
    prisma.user.findFirst.mockResolvedValue({ id: userId });
    prisma.$transaction.mockImplementation(
      (callback: (tx: typeof prisma) => unknown) => callback(prisma),
    );

    await expect(
      service.signup({
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        password: 'secret123',
      }),
    ).rejects.toEqual(new ConflictException('Email is already registered.'));
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(authSessionService.issueSession).not.toHaveBeenCalled();
  });

  it('does not commit the user when neutral session issuance fails', async () => {
    let committed = false;
    passwordHasher.hash.mockResolvedValue('signup-hash');
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: userId });
    authSessionService.issueSession.mockRejectedValueOnce(
      new Error('session insert failed'),
    );
    prisma.$transaction.mockImplementation(
      async (callback: (tx: typeof prisma) => Promise<unknown>) => {
        const result = await callback(prisma);
        committed = true;
        return result;
      },
    );

    await expect(
      service.signup({
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        password: 'secret123',
      }),
    ).rejects.toEqual(
      new ServiceUnavailableException(
        'Authentication service temporarily unavailable.',
      ),
    );
    expect(committed).toBe(false);
  });

  it('automatically binds a login session when exactly one membership is active', async () => {
    prisma.user.findMany.mockResolvedValue([
      {
        id: userId,
        email: 'ada@example.com',
        passwordHash: 'hash',
        isActive: true,
        mustChangePassword: true,
        memberships: [
          {
            id: membershipId,
            workshopId,
            role: { name: UserRole.OWNER },
            workshop: { id: workshopId, name: 'RacerLab' },
          },
        ],
      },
    ]);

    await expect(
      service.login({ email: ' ADA@EXAMPLE.COM ', password: 'secret123' }),
    ).resolves.toMatchObject({
      accessToken: 'access-token',
      activeWorkshop: {
        workshopId,
        membershipId,
        role: UserRole.OWNER,
      },
      requiresWorkshopSelection: false,
      requiresPasswordChange: true,
    });
    expect(authSessionService.issueSession).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: expect.any(String),
        userId,
        activeMembershipId: membershipId,
      }),
    );
    expect(jwtService.signAsync).toHaveBeenCalledWith(
      {
        sub: userId,
        sid: expect.any(String),
        wid: workshopId,
        mid: membershipId,
      },
      expect.any(Object),
    );
    expect(authSessionService.issueSession.mock.calls[0][0].sessionId).toBe(
      jwtService.signAsync.mock.calls[0][0].sid,
    );
  });

  it('issues a neutral session when several memberships are active', async () => {
    prisma.user.findMany.mockResolvedValue([
      {
        id: userId,
        email: 'ada@example.com',
        passwordHash: 'hash',
        isActive: true,
        mustChangePassword: false,
        memberships: [{ id: 'one' }, { id: 'two' }],
      },
    ]);

    await expect(
      service.login({ email: 'ada@example.com', password: 'secret123' }),
    ).resolves.toMatchObject({
      activeWorkshop: null,
      requiresWorkshopSelection: true,
      requiresPasswordChange: false,
    });
    expect(authSessionService.issueSession).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: expect.any(String),
        userId,
        activeMembershipId: undefined,
      }),
    );
    expect(jwtService.signAsync).toHaveBeenCalledWith(
      { sub: userId, sid: expect.any(String) },
      expect.any(Object),
    );
    expect(authSessionService.issueSession.mock.calls[0][0].sessionId).toBe(
      jwtService.signAsync.mock.calls[0][0].sid,
    );
  });

  it('rejects selection of a workshop outside the current user memberships', async () => {
    prisma.membership.findFirst.mockResolvedValue(null);

    await expect(
      service.selectWorkshop(
        {
          id: userId,
          email: 'ada@example.com',
          isActive: true,
          mustChangePassword: false,
          sessionId,
        },
        workshopId,
      ),
    ).rejects.toEqual(
      new UnauthorizedException('Workshop membership is not available.'),
    );
    expect(prisma.membership.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId,
          workshopId,
          isActive: true,
        },
      }),
    );
  });

  it('changes the password, clears the forced flag and revokes other sessions', async () => {
    prisma.user.findUnique.mockResolvedValue({
      passwordHash: 'old-hash',
      isActive: true,
    });
    passwordHasher.verify
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    passwordHasher.hash.mockResolvedValue('new-hash');
    prisma.$transaction.mockImplementation(
      (callback: (tx: typeof prisma) => unknown) => callback(prisma),
    );

    await service.changePassword(
      {
        id: userId,
        email: 'ada@example.com',
        isActive: true,
        mustChangePassword: true,
        sessionId,
      },
      'old-secret',
      'new-secret',
    );

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: userId },
      data: { passwordHash: 'new-hash', mustChangePassword: false },
    });
    expect(prisma.authSession.updateMany).toHaveBeenCalledWith({
      where: {
        userId,
        id: { not: sessionId },
        revokedAt: null,
      },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('rejects reusing the current password', async () => {
    prisma.user.findUnique.mockResolvedValue({
      passwordHash: 'old-hash',
      isActive: true,
    });
    passwordHasher.verify.mockResolvedValue(true);

    await expect(
      service.changePassword(
        {
          id: userId,
          email: 'ada@example.com',
          isActive: true,
          mustChangePassword: true,
          sessionId,
        },
        'same-secret',
        'same-secret',
      ),
    ).rejects.toEqual(
      new BadRequestException(
        'The new password must differ from the current password.',
      ),
    );
    expect(passwordHasher.hash).not.toHaveBeenCalled();
  });
});
