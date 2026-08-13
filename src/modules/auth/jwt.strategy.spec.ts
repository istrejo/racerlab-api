import { UnauthorizedException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy tenant resolution', () => {
  const userId = '2f1b7652-92f6-4a32-863f-26b5af5e0c12';
  const sessionId = '66e37e48-b2df-4de4-b726-56c958403c8e';
  const workshopId = 'e79033dc-7d16-421f-ae1a-d216f9a306d7';
  const membershipId = '6650e2ef-c46a-4fe2-875e-4af7c576e12d';
  const prisma = {
    authSession: { findFirst: jest.fn() },
  };
  let strategy: JwtStrategy;

  beforeAll(() => {
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.AUTH_REFRESH_TOKEN_SECRET = 'test-refresh-token-secret';
    process.env.JWT_ACCESS_TOKEN_TTL = '15m';
  });

  beforeEach(() => {
    jest.clearAllMocks();
    strategy = new JwtStrategy(prisma as never);
  });

  it('loads the live OWNER role from the active membership', async () => {
    prisma.authSession.findFirst.mockResolvedValue({
      id: sessionId,
      user: {
        id: userId,
        email: 'owner@example.com',
        isActive: true,
        mustChangePassword: true,
      },
      activeMembership: {
        id: membershipId,
        workshopId,
        isActive: true,
        role: { name: UserRole.OWNER },
        workshop: { id: workshopId },
      },
    });

    await expect(
      strategy.validate({
        sub: userId,
        sid: sessionId,
        wid: workshopId,
        mid: membershipId,
      }),
    ).resolves.toEqual({
      id: userId,
      email: 'owner@example.com',
      isActive: true,
      mustChangePassword: true,
      sessionId,
      membershipId,
      workshopId,
      role: UserRole.OWNER,
    });
  });

  it('accepts a valid neutral session without workshop claims', async () => {
    prisma.authSession.findFirst.mockResolvedValue({
      id: sessionId,
      user: {
        id: userId,
        email: 'user@example.com',
        isActive: true,
        mustChangePassword: false,
      },
      activeMembership: null,
    });

    await expect(
      strategy.validate({ sub: userId, sid: sessionId }),
    ).resolves.toEqual({
      id: userId,
      email: 'user@example.com',
      isActive: true,
      mustChangePassword: false,
      sessionId,
    });
  });

  it('rejects stale workshop claims after the session context changes', async () => {
    prisma.authSession.findFirst.mockResolvedValue({
      id: sessionId,
      user: {
        id: userId,
        email: 'user@example.com',
        isActive: true,
        mustChangePassword: false,
      },
      activeMembership: null,
    });

    await expect(
      strategy.validate({
        sub: userId,
        sid: sessionId,
        wid: workshopId,
        mid: membershipId,
      }),
    ).rejects.toEqual(new UnauthorizedException('Invalid access token.'));
  });

  it('rejects tokens without a valid session id before querying Prisma', async () => {
    await expect(strategy.validate({ sub: userId })).rejects.toEqual(
      new UnauthorizedException('Invalid access token.'),
    );
    expect(prisma.authSession.findFirst).not.toHaveBeenCalled();
  });
});
