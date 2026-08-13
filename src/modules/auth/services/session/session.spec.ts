/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { UnauthorizedException } from '@nestjs/common';
import { AuthSessionService } from './session';

describe('AuthSessionService', () => {
  const sessionId = '66e37e48-b2df-4de4-b726-56c958403c8e';
  const currentTokenId = '0f32bb35-6318-4421-b9ef-f2f4474838ac';
  const replacementTokenId = '94e10773-3e0d-4fb8-927f-f9afef14f7a5';
  const now = new Date('2026-08-13T12:00:00.000Z');
  const session = {
    id: sessionId,
    userId: '2f1b7652-92f6-4a32-863f-26b5af5e0c12',
    expiresAt: new Date('2026-09-01T12:00:00.000Z'),
    revokedAt: null,
    user: {
      id: '2f1b7652-92f6-4a32-863f-26b5af5e0c12',
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      isActive: true,
      mustChangePassword: false,
    },
    activeMembership: null,
  };
  const prisma = {
    authSession: { create: jest.fn(), updateMany: jest.fn() },
    refreshToken: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const tokenService = {
    issueRefreshToken: jest.fn(),
    parseRefreshToken: jest.fn(),
    serializeRefreshToken: jest.fn(),
  };
  let service: AuthSessionService;

  beforeAll(() => {
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.JWT_ACCESS_TOKEN_TTL = '15m';
    process.env.AUTH_REFRESH_TOKEN_SECRET = 'test-refresh-token-secret';
  });

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(
      (callback: (tx: typeof prisma) => unknown) => callback(prisma),
    );
    tokenService.issueRefreshToken.mockReturnValue({
      id: replacementTokenId,
      value: 'replacement.refresh',
    });
    tokenService.parseRefreshToken.mockReturnValue(currentTokenId);
    tokenService.serializeRefreshToken.mockReturnValue('replacement.refresh');
    service = new AuthSessionService(prisma as never, tokenService as never);
  });

  it('creates one stable session with its initial refresh token', async () => {
    tokenService.issueRefreshToken.mockReturnValueOnce({
      id: currentTokenId,
      value: 'current.refresh',
    });
    prisma.authSession.create.mockResolvedValue({ id: sessionId });

    await expect(
      service.issueSession({
        sessionId,
        userId: session.userId,
        context: { userAgent: 'test', ipAddress: '127.0.0.1' },
        now,
      }),
    ).resolves.toMatchObject({
      session: { id: sessionId },
      refreshToken: 'current.refresh',
    });
    expect(prisma.authSession.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: sessionId,
        userId: session.userId,
        refreshTokens: {
          create: expect.objectContaining({ id: currentTokenId }),
        },
      }),
    });
  });

  it('rotates a refresh token without replacing the stable session', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: currentTokenId,
      sessionId,
      expiresAt: session.expiresAt,
      consumedAt: null,
      revokedAt: null,
      replacedBy: null,
      session,
    });
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });
    prisma.authSession.updateMany.mockResolvedValue({ count: 1 });

    await expect(
      service.rotateRefreshToken('current.refresh', {}, now),
    ).resolves.toMatchObject({
      session: { id: sessionId },
      refreshToken: 'replacement.refresh',
    });
    expect(prisma.refreshToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: replacementTokenId,
        sessionId,
      }),
    });
    expect(prisma.authSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: sessionId }),
      }),
    );
  });

  it('returns the same replacement during the five-second concurrency window', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: currentTokenId,
      sessionId,
      expiresAt: session.expiresAt,
      consumedAt: new Date(now.getTime() - 2_000),
      revokedAt: null,
      replacedBy: {
        id: replacementTokenId,
        expiresAt: session.expiresAt,
        revokedAt: null,
      },
      session,
    });

    await expect(
      service.rotateRefreshToken('current.refresh', {}, now),
    ).resolves.toMatchObject({
      session: { id: sessionId },
      refreshToken: 'replacement.refresh',
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('revokes the stable session when a consumed token is replayed later', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: currentTokenId,
      sessionId,
      expiresAt: session.expiresAt,
      consumedAt: new Date(now.getTime() - 5_001),
      revokedAt: null,
      replacedBy: {
        id: replacementTokenId,
        expiresAt: session.expiresAt,
        revokedAt: null,
      },
      session,
    });
    prisma.authSession.updateMany.mockResolvedValue({ count: 1 });
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 2 });

    await expect(
      service.rotateRefreshToken('current.refresh', {}, now),
    ).rejects.toEqual(new UnauthorizedException('Invalid refresh session.'));
    expect(prisma.authSession.updateMany).toHaveBeenCalledWith({
      where: { id: sessionId, revokedAt: null },
      data: expect.objectContaining({ revokedAt: now }),
    });
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { sessionId, revokedAt: null },
      data: { revokedAt: now },
    });
  });
});
