import {
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PasswordHasherService } from '../../common/security/password-hasher.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    user: { findUnique: jest.Mock };
  };
  let passwordHasher: Pick<PasswordHasherService, 'verify'> & {
    verify: jest.Mock;
  };
  let jwtService: {
    signAsync: jest.Mock;
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

  let loggerErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn() },
    };
    passwordHasher = { verify: jest.fn() };
    jwtService = { signAsync: jest.fn() };

    service = new AuthService(
      prisma as unknown as PrismaService,
      passwordHasher as unknown as PasswordHasherService,
      jwtService as never,
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
    passwordHasher.verify.mockResolvedValue(true);
    jwtService.signAsync.mockResolvedValue('signed.jwt.token');

    await expect(
      service.login({
        email: '  ADA@EXAMPLE.COM  ',
        password: 'super-secret',
      }),
    ).resolves.toEqual({
      accessToken: 'signed.jwt.token',
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
    expect(jwtService.signAsync).toHaveBeenCalledWith({ sub: storedUser.id });
  });

  it.each([
    {
      caseName: 'unknown email',
      user: null,
      verifyResult: null,
    },
    {
      caseName: 'inactive user',
      user: { ...storedUser, isActive: false },
      verifyResult: null,
    },
    {
      caseName: 'wrong password',
      user: storedUser,
      verifyResult: false,
    },
  ])(
    'rejects %s with the same unauthorized response',
    async ({ user, verifyResult }) => {
      prisma.user.findUnique.mockResolvedValue(user);
      passwordHasher.verify.mockResolvedValue(verifyResult);

      await expect(
        service.login({
          email: 'ada@example.com',
          password: 'wrong-secret',
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
});
