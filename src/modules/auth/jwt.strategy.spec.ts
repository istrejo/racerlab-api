import {
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { applyJwtTestEnv } from '../../testing/jwt-test-env';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  let prisma: {
    user: {
      findUnique: jest.Mock;
    };
  };
  let strategy: JwtStrategy;
  let restoreJwtTestEnv: () => void;

  beforeEach(() => {
    restoreJwtTestEnv = applyJwtTestEnv();
    prisma = {
      user: {
        findUnique: jest.fn(),
      },
    };
    strategy = new JwtStrategy(prisma as unknown as PrismaService);
  });

  afterEach(() => {
    restoreJwtTestEnv();
  });

  it('reloads the active user and returns the current database role instead of a stale token claim', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: '2f1b7652-92f6-4a32-863f-26b5af5e0c12',
      email: 'ada@example.com',
      isActive: true,
      role: { name: UserRole.MANAGER },
    });

    await expect(
      strategy.validate({
        sub: '2f1b7652-92f6-4a32-863f-26b5af5e0c12',
        role: UserRole.ADMIN,
      }),
    ).resolves.toEqual({
      id: '2f1b7652-92f6-4a32-863f-26b5af5e0c12',
      email: 'ada@example.com',
      role: UserRole.MANAGER,
      isActive: true,
    });

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: '2f1b7652-92f6-4a32-863f-26b5af5e0c12' },
      include: { role: { select: { name: true } } },
    });
  });

  it.each([
    { caseName: 'the user no longer exists', user: null },
    {
      caseName: 'the user was deactivated after token issuance',
      user: {
        id: '2f1b7652-92f6-4a32-863f-26b5af5e0c12',
        email: 'ada@example.com',
        isActive: false,
        role: { name: UserRole.ADMIN },
      },
    },
  ])('rejects a token when $caseName', async ({ user }) => {
    prisma.user.findUnique.mockResolvedValue(user);

    await expect(
      strategy.validate({ sub: '2f1b7652-92f6-4a32-863f-26b5af5e0c12' }),
    ).rejects.toEqual(new UnauthorizedException('User is no longer active.'));
  });

  it.each([
    { caseName: 'a missing subject', payload: {} },
    { caseName: 'an empty subject', payload: { sub: '' } },
    { caseName: 'a non-string subject', payload: { sub: 42 } },
    { caseName: 'a malformed subject', payload: { sub: 'not-a-uuid' } },
  ])('rejects $caseName before querying Prisma', async ({ payload }) => {
    await expect(strategy.validate(payload)).rejects.toEqual(
      new UnauthorizedException('Invalid token subject.'),
    );

    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('maps Prisma failures to a generic service-unavailable response without logging token details', async () => {
    const databaseError = new Error(
      'database offline for 2f1b7652-92f6-4a32-863f-26b5af5e0c12',
    );
    const loggerError = jest.spyOn(Logger.prototype, 'error');
    prisma.user.findUnique.mockRejectedValue(databaseError);

    await expect(
      strategy.validate({ sub: '2f1b7652-92f6-4a32-863f-26b5af5e0c12' }),
    ).rejects.toEqual(
      new ServiceUnavailableException(
        'Authentication service temporarily unavailable.',
      ),
    );

    expect(loggerError).toHaveBeenCalledWith(
      'JWT user revalidation failed due to an internal dependency.',
    );
    expect(loggerError).not.toHaveBeenCalledWith(
      expect.stringContaining('2f1b7652-92f6-4a32-863f-26b5af5e0c12'),
    );
  });
});
