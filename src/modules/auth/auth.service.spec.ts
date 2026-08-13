/* eslint-disable @typescript-eslint/no-unsafe-assignment */
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
  const authTokenService = {
    signAccessToken: jest.fn().mockResolvedValue('access-token'),
  };
  const authSessionService = {
    issueSession: jest.fn().mockResolvedValue({
      refreshToken: 'refresh-token',
      expiresAt: new Date('2026-08-26T00:00:00.000Z'),
      session: { id: sessionId },
    }),
    rotateRefreshToken: jest.fn(),
    revokeByRefreshToken: jest.fn(),
    revokeAllUserSessions: jest.fn(),
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
    authSession: {
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    refreshToken: { updateMany: jest.fn() },
    $transaction: jest.fn(),
  };
  let service: AuthService;

  beforeAll(() => {
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.AUTH_REFRESH_TOKEN_SECRET = 'test-refresh-token-secret';
    process.env.JWT_ACCESS_TOKEN_TTL = '15m';
  });

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService(
      prisma as never,
      passwordHasher,
      authSessionService as never,
      authTokenService as never,
    );
  });

  it('creates a global user and neutral session in one transaction', async () => {
    passwordHasher.hash.mockResolvedValue('signup-hash');
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: userId,
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      mustChangePassword: false,
    });
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
      select: {
        id: true,
        name: true,
        email: true,
        mustChangePassword: true,
      },
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
    prisma.user.create.mockResolvedValue({
      id: userId,
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      mustChangePassword: false,
    });
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
        name: 'Ada Lovelace',
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
        userId,
        activeMembershipId: membershipId,
      }),
    );
    expect(authTokenService.signAccessToken).toHaveBeenCalledWith(
      userId,
      sessionId,
      expect.objectContaining({ id: membershipId }),
    );
  });

  it('issues a neutral session when several memberships are active', async () => {
    prisma.user.findMany.mockResolvedValue([
      {
        id: userId,
        name: 'Ada Lovelace',
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
        userId,
        activeMembershipId: undefined,
      }),
    );
    expect(authTokenService.signAccessToken).toHaveBeenCalledWith(
      userId,
      sessionId,
      null,
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

  it('returns only the safe active bootstrap context from the current session', async () => {
    // The JWT strategy already validated the session. getMe now fetches only
    // the user profile and membership profile via two lighter parallel queries.
    prisma.user.findUnique.mockResolvedValue({
      id: userId,
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      mustChangePassword: true,
    });
    prisma.membership.findFirst.mockResolvedValue({
      id: membershipId,
      workshopId,
      displayName: 'Ada',
      phone: '+54 11 5555 5555',
      address: 'Garage Street 1',
      role: { name: UserRole.OWNER },
      workshop: { id: workshopId, name: 'RacerLab' },
    });

    await expect(
      service.getMe({
        id: userId,
        email: 'ada@example.com',
        isActive: true,
        mustChangePassword: true,
        sessionId,
        membershipId,
        workshopId,
        role: UserRole.OWNER,
      }),
    ).resolves.toEqual({
      user: { id: userId, name: 'Ada Lovelace', email: 'ada@example.com' },
      activeWorkshop: {
        workshopId,
        membershipId,
        name: 'RacerLab',
        role: UserRole.OWNER,
        profile: {
          displayName: 'Ada',
          phone: '+54 11 5555 5555',
          address: 'Garage Street 1',
        },
      },
      requiresPasswordChange: true,
    });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: userId, isActive: true },
      select: {
        id: true,
        name: true,
        email: true,
        mustChangePassword: true,
      },
    });
    expect(prisma.membership.findFirst).toHaveBeenCalledWith({
      where: { id: membershipId, userId, isActive: true },
      select: {
        id: true,
        workshopId: true,
        displayName: true,
        phone: true,
        address: true,
        role: { select: { name: true } },
        workshop: { select: { id: true, name: true } },
      },
    });
  });

  it('maps a valid neutral session to a null active workshop without sensitive fields', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: userId,
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      mustChangePassword: false,
    });

    const result = await service.getMe({
      id: userId,
      email: 'ada@example.com',
      isActive: true,
      mustChangePassword: false,
      sessionId,
      // no membershipId → neutral session, no workshop query
    });

    expect(result).toEqual({
      user: { id: userId, name: 'Ada Lovelace', email: 'ada@example.com' },
      activeWorkshop: null,
      requiresPasswordChange: false,
    });
    expect(result).not.toHaveProperty('passwordHash');
    expect(result).not.toHaveProperty('accessToken');
    expect(result).not.toHaveProperty('refreshToken');
    expect(result).not.toHaveProperty('sessionId');
    expect(result).not.toHaveProperty('permissions');
    expect(prisma.membership.findFirst).not.toHaveBeenCalled();
  });

  it('rejects a missing or inactive current session', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.getMe({
        id: userId,
        email: 'ada@example.com',
        isActive: true,
        mustChangePassword: false,
        sessionId,
      }),
    ).rejects.toEqual(new UnauthorizedException('Invalid access session.'));
  });

  it('maps current-session dependency failures to service unavailable', async () => {
    prisma.user.findUnique.mockRejectedValue(new Error('database down'));

    await expect(
      service.getMe({
        id: userId,
        email: 'ada@example.com',
        isActive: true,
        mustChangePassword: false,
        sessionId,
      }),
    ).rejects.toEqual(
      new ServiceUnavailableException(
        'Authentication service temporarily unavailable.',
      ),
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

  it('issues a new access token for the same stable session during refresh', async () => {
    authSessionService.rotateRefreshToken.mockResolvedValue({
      refreshToken: 'replacement-refresh-token',
      expiresAt: new Date('2026-08-27T12:00:00.000Z'),
      session: {
        id: sessionId,
        userId,
        user: {
          id: userId,
          name: 'Ada Lovelace',
          email: 'ada@example.com',
          isActive: true,
          mustChangePassword: false,
        },
        activeMembership: null,
      },
    });

    await expect(
      service.refresh('current-refresh-token'),
    ).resolves.toMatchObject({
      accessToken: 'access-token',
      refreshToken: 'replacement-refresh-token',
      user: { id: userId, name: 'Ada Lovelace' },
    });
    expect(authTokenService.signAccessToken).toHaveBeenCalledWith(
      userId,
      sessionId,
      null,
    );
  });
});
