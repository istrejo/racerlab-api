import {
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthSession, UserRole } from '@prisma/client';
import { PasswordHasherService } from '../../common/security/password-hasher.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    user: { findUnique: jest.Mock; findMany: jest.Mock };
    authSession: { update: jest.Mock; updateMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let passwordHasher: Pick<PasswordHasherService, 'verify'> & {
    verify: jest.Mock;
  };
  let jwtService: {
    signAsync: jest.Mock;
  };
  let authSessionService: {
    issueSession: jest.Mock;
    findSessionByToken: jest.Mock;
  };

  const storedUser = {
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

  const activeSession = {
    id: 'session-1',
    userId: storedUser.id,
    tokenFamilyId: 'family-1',
    tokenHash: 'stored-hash',
    expiresAt: new Date('2026-08-12T00:00:00.000Z'),
    consumedAt: null,
    revokedAt: null,
    replacedBySessionId: null,
    createdUserAgent: 'Workshop iPad',
    createdIp: '10.10.0.15',
    lastUsedUserAgent: 'Workshop iPad',
    lastUsedIp: '10.10.0.15',
    createdAt: new Date('2026-07-13T10:00:00.000Z'),
    updatedAt: new Date('2026-07-13T10:00:00.000Z'),
    user: storedUser,
  } satisfies AuthSession & { user: typeof storedUser };

  let loggerErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn(), findMany: jest.fn() },
      authSession: { update: jest.fn(), updateMany: jest.fn() },
      $transaction: jest.fn(),
    };
    passwordHasher = { verify: jest.fn() };
    jwtService = { signAsync: jest.fn() };
    authSessionService = {
      issueSession: jest.fn(),
      findSessionByToken: jest.fn(),
    };

    service = new AuthService(
      prisma as unknown as PrismaService,
      passwordHasher as unknown as PasswordHasherService,
      jwtService as never,
      authSessionService as never,
    );

    loggerErrorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    loggerErrorSpy.mockRestore();
  });

  it('returns an access token only for valid active credentials and normalizes the email lookup', async () => {
    prisma.user.findUnique.mockResolvedValue(storedUser);
    prisma.user.findMany.mockResolvedValue([storedUser]);
    passwordHasher.verify.mockResolvedValue(true);
    jwtService.signAsync.mockResolvedValue('signed.jwt.token');
    authSessionService.issueSession.mockResolvedValue({
      refreshToken: 'refresh-token',
      expiresAt: new Date('2026-08-12T00:00:00.000Z'),
      session: { id: 'session-1', tokenFamilyId: 'family-1' },
    });

    await expect(
      service.login({
        email: '  ADA@EXAMPLE.COM  ',
        password: 'super-secret',
      }, {
        userAgent: 'Workshop iPad',
        ipAddress: '10.10.0.15',
      }),
    ).resolves.toEqual({
      accessToken: 'signed.jwt.token',
      refreshToken: 'refresh-token',
      refreshTokenExpiresAt: new Date('2026-08-12T00:00:00.000Z'),
      tokenType: 'Bearer',
    });

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'ada@example.com' },
      include: { role: true },
    });
    expect(passwordHasher.verify).toHaveBeenCalledWith(
      'super-secret',
      storedUser.passwordHash,
    );
    expect(jwtService.signAsync).toHaveBeenCalledWith(
      { sub: storedUser.id },
      { expiresIn: '15m' },
    );
    expect(authSessionService.issueSession).toHaveBeenCalledWith({
      userId: storedUser.id,
      userAgent: 'Workshop iPad',
      ipAddress: '10.10.0.15',
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
  });

  it('authenticates a legacy mixed-case stored email through the compatibility lookup', async () => {
    const legacyStoredUser = {
      ...storedUser,
      email: 'Ada@Example.com',
    };

    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.findMany.mockResolvedValue([legacyStoredUser]);
    passwordHasher.verify.mockResolvedValue(true);
    jwtService.signAsync.mockResolvedValue('signed.jwt.token');
    authSessionService.issueSession.mockResolvedValue({
      refreshToken: 'refresh-token',
      expiresAt: new Date('2026-08-12T00:00:00.000Z'),
      session: { id: 'session-1', tokenFamilyId: 'family-1' },
    });

    await expect(
      service.login({
        email: '  ADA@EXAMPLE.COM  ',
        password: 'super-secret',
      }, {
        userAgent: 'Workshop iPad',
        ipAddress: '10.10.0.15',
      }),
    ).resolves.toEqual({
      accessToken: 'signed.jwt.token',
      refreshToken: 'refresh-token',
      refreshTokenExpiresAt: new Date('2026-08-12T00:00:00.000Z'),
      tokenType: 'Bearer',
    });

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
      legacyStoredUser.passwordHash,
    );
  });

  it('rejects ambiguous legacy case-insensitive matches deterministically', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.findMany.mockResolvedValue([
      { ...storedUser, id: 'user-1', email: 'Ada@Example.com' },
      { ...storedUser, id: 'user-2', email: 'ADA@example.com' },
    ]);

    await expect(
        service.login({
          email: 'ada@example.com',
          password: 'super-secret',
        }, {
          userAgent: 'Workshop iPad',
          ipAddress: '10.10.0.15',
        }),
      ).rejects.toEqual(new UnauthorizedException('Invalid credentials.'));

    expect(passwordHasher.verify).not.toHaveBeenCalled();
    expect(jwtService.signAsync).not.toHaveBeenCalled();
  });

  it('rejects login when an exact lowercase row coexists with a legacy mixed-case duplicate', async () => {
    prisma.user.findUnique.mockResolvedValue(storedUser);
    prisma.user.findMany.mockResolvedValue([
      storedUser,
      { ...storedUser, id: 'user-2', email: 'Ada@Example.com' },
    ]);

    await expect(
        service.login({
          email: 'ada@example.com',
          password: 'super-secret',
        }, {
          userAgent: 'Workshop iPad',
          ipAddress: '10.10.0.15',
        }),
      ).rejects.toEqual(new UnauthorizedException('Invalid credentials.'));

    expect(passwordHasher.verify).not.toHaveBeenCalled();
    expect(jwtService.signAsync).not.toHaveBeenCalled();
  });

  it.each([
    {
      caseName: 'unknown email',
      user: null,
      compatibilityMatches: [],
      verifyResult: null,
    },
    {
      caseName: 'inactive user',
      user: { ...storedUser, isActive: false },
      compatibilityMatches: [],
      verifyResult: null,
    },
    {
      caseName: 'wrong password',
      user: storedUser,
      compatibilityMatches: [],
      verifyResult: false,
    },
  ])(
    'rejects %s with the same unauthorized response',
    async ({ user, compatibilityMatches, verifyResult }) => {
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.user.findMany.mockResolvedValue(compatibilityMatches);
      passwordHasher.verify.mockResolvedValue(verifyResult);

      await expect(
        service.login({
          email: 'ada@example.com',
          password: 'wrong-secret',
        }, {
          userAgent: 'Workshop iPad',
          ipAddress: '10.10.0.15',
        }),
      ).rejects.toEqual(new UnauthorizedException('Invalid credentials.'));

      expect(jwtService.signAsync).not.toHaveBeenCalled();
    },
  );

  it.each([
    {
      caseName: 'user lookup dependency fails',
      arrange: () => {
        prisma.user.findUnique.mockRejectedValue(new Error('database offline'));
      },
    },
    {
      caseName: 'password verification dependency fails',
      arrange: () => {
        prisma.user.findUnique.mockResolvedValue(storedUser);
        passwordHasher.verify.mockRejectedValue(new Error('argon2 failed'));
      },
    },
    {
      caseName: 'token signing dependency fails',
      arrange: () => {
        prisma.user.findUnique.mockResolvedValue(storedUser);
        passwordHasher.verify.mockResolvedValue(true);
        jwtService.signAsync.mockRejectedValue(new Error('jwt unavailable'));
      },
    },
  ])(
    'fails closed with a service-unavailable response and generic logging when %s',
    async ({ arrange }) => {
      arrange();

      await expect(
        service.login({
          email: 'ada@example.com',
          password: 'super-secret',
        }, {
          userAgent: 'Workshop iPad',
          ipAddress: '10.10.0.15',
        }),
      ).rejects.toEqual(
        new ServiceUnavailableException(
          'Authentication service temporarily unavailable.',
        ),
      );

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'Authentication login failed due to an internal dependency.',
        expect.any(String),
      );

      const [[loggedMessage = '', loggedTrace = ''] = []] = loggerErrorSpy.mock
        .calls as [string, string?][];

      expect(loggedMessage).not.toContain('ada@example.com');
      expect(loggedTrace ?? '').not.toContain('super-secret');
    },
  );

  it.each([
    {
      caseName: 'missing refresh token',
      refreshToken: undefined,
      session: null,
    },
    {
      caseName: 'unknown refresh token',
      refreshToken: 'unknown-refresh-token',
      session: null,
    },
    {
      caseName: 'inactive user session',
      refreshToken: 'inactive-user-refresh-token',
      session: {
        ...activeSession,
        user: { ...storedUser, isActive: false },
      },
    },
  ])(
    'rejects %s with the same generic unauthorized response',
    async ({ refreshToken, session }) => {
      authSessionService.findSessionByToken.mockResolvedValue(session);

      await expect(
        service.refresh(refreshToken, {
          userAgent: 'Workshop iPad',
          ipAddress: '10.10.0.15',
        }),
      ).rejects.toEqual(new UnauthorizedException('Invalid refresh session.'));

      expect(jwtService.signAsync).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    },
  );

  it('rotates an active refresh session transactionally and returns replacement credentials', async () => {
    authSessionService.findSessionByToken.mockResolvedValue(activeSession);
    prisma.authSession.updateMany.mockResolvedValue({ count: 1 });
    authSessionService.issueSession.mockResolvedValue({
      refreshToken: 'replacement-refresh-token',
      expiresAt: new Date('2026-08-30T00:00:00.000Z'),
      session: { id: 'session-2', tokenFamilyId: activeSession.tokenFamilyId },
    });
    prisma.$transaction.mockImplementation(async (callback: Function) =>
      callback(prisma),
    );
    jwtService.signAsync.mockResolvedValue('replacement-access-token');

    await expect(
      service.refresh('current-refresh-token', {
        userAgent: 'Workshop iPad',
        ipAddress: '10.10.0.16',
      }),
    ).resolves.toEqual({
      accessToken: 'replacement-access-token',
      refreshToken: 'replacement-refresh-token',
      refreshTokenExpiresAt: new Date('2026-08-30T00:00:00.000Z'),
      tokenType: 'Bearer',
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.authSession.updateMany).toHaveBeenCalledWith({
      where: {
        id: activeSession.id,
        consumedAt: null,
        revokedAt: null,
        expiresAt: { gt: expect.any(Date) },
      },
      data: {
        consumedAt: expect.any(Date),
        lastUsedUserAgent: 'Workshop iPad',
        lastUsedIp: '10.10.0.16',
      },
    });
    expect(authSessionService.issueSession).toHaveBeenCalledWith(
      expect.objectContaining({
        prisma: prisma,
        userId: storedUser.id,
        tokenFamilyId: activeSession.tokenFamilyId,
        userAgent: 'Workshop iPad',
        ipAddress: '10.10.0.16',
      }),
    );
    expect(prisma.authSession.update).toHaveBeenCalledWith({
      where: { id: activeSession.id },
      data: {
        replacedBySessionId: 'session-2',
      },
    });
    expect(jwtService.signAsync).toHaveBeenCalledWith(
      { sub: storedUser.id },
      { expiresIn: '15m' },
    );
  });

  it('treats a failed guarded consume as refresh-token replay before minting a replacement session', async () => {
    authSessionService.findSessionByToken.mockResolvedValue(activeSession);
    prisma.authSession.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });
    prisma.$transaction.mockImplementation(async (callback: Function) =>
      callback(prisma),
    );
    jwtService.signAsync.mockResolvedValue('unused-access-token');

    await expect(
      service.refresh('current-refresh-token', {
        userAgent: 'Workshop iPad',
        ipAddress: '10.10.0.16',
      }),
    ).rejects.toEqual(new UnauthorizedException('Invalid refresh session.'));

    expect(prisma.authSession.updateMany).toHaveBeenNthCalledWith(1, {
      where: {
        id: activeSession.id,
        consumedAt: null,
        revokedAt: null,
        expiresAt: { gt: expect.any(Date) },
      },
      data: {
        consumedAt: expect.any(Date),
        lastUsedUserAgent: 'Workshop iPad',
        lastUsedIp: '10.10.0.16',
      },
    });
    expect(prisma.authSession.updateMany).toHaveBeenNthCalledWith(2, {
      where: {
        tokenFamilyId: activeSession.tokenFamilyId,
        revokedAt: null,
      },
      data: {
        revokedAt: expect.any(Date),
      },
    });
    expect(authSessionService.issueSession).not.toHaveBeenCalled();
    expect(prisma.authSession.update).not.toHaveBeenCalled();
  });

  it('does not consume the refresh session when access-token signing fails', async () => {
    authSessionService.findSessionByToken.mockResolvedValue(activeSession);
    jwtService.signAsync.mockRejectedValue(new Error('jwt unavailable'));

    await expect(
      service.refresh('current-refresh-token', {
        userAgent: 'Workshop iPad',
        ipAddress: '10.10.0.16',
      }),
    ).rejects.toEqual(
      new ServiceUnavailableException(
        'Authentication service temporarily unavailable.',
      ),
    );

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.authSession.updateMany).not.toHaveBeenCalled();
    expect(authSessionService.issueSession).not.toHaveBeenCalled();
  });

  it('revokes the refresh-token family when a rotated token is replayed', async () => {
    authSessionService.findSessionByToken.mockResolvedValue({
      ...activeSession,
      consumedAt: new Date('2026-07-13T10:05:00.000Z'),
      replacedBySessionId: 'session-2',
    });
    prisma.$transaction.mockImplementation(async (callback: Function) =>
      callback(prisma),
    );

    await expect(
      service.refresh('replayed-refresh-token', {
        userAgent: 'Workshop iPad',
        ipAddress: '10.10.0.16',
      }),
    ).rejects.toEqual(new UnauthorizedException('Invalid refresh session.'));

    expect(prisma.authSession.updateMany).toHaveBeenCalledWith({
      where: {
        tokenFamilyId: activeSession.tokenFamilyId,
        revokedAt: null,
      },
      data: {
        revokedAt: expect.any(Date),
      },
    });
    expect(authSessionService.issueSession).not.toHaveBeenCalled();
    expect(jwtService.signAsync).not.toHaveBeenCalled();
  });
});
