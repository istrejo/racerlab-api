import { createHash, randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthSessionService } from './auth-session.service';

describe('AuthSessionService', () => {
  let service: AuthSessionService;
  let prisma: {
    authSession: {
      create: jest.Mock;
      findFirst: jest.Mock;
    };
  };

  beforeEach(() => {
    prisma = {
      authSession: {
        create: jest.fn(),
        findFirst: jest.fn(),
      },
    };

    service = new AuthSessionService(prisma as unknown as PrismaService);
  });

  it('stores only a token hash, creates a token family, and captures initial metadata', async () => {
    prisma.authSession.create.mockResolvedValue({
      id: 'session-1',
      tokenFamilyId: 'family-1',
      tokenHash: 'persisted-hash',
    });

    await service.createSession({
      userId: '6f752649-f1a7-4fb0-b8da-b1bf9d7c77c6',
      refreshToken: 'plain-refresh-token',
      expiresAt: new Date('2026-08-12T00:00:00.000Z'),
      userAgent: 'Workshop iPad',
      ipAddress: '10.10.0.15',
    });

    expect(prisma.authSession.create).toHaveBeenCalledTimes(1);

    const createArgs = prisma.authSession.create.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };

    expect(createArgs.data).toMatchObject({
      userId: '6f752649-f1a7-4fb0-b8da-b1bf9d7c77c6',
      createdUserAgent: 'Workshop iPad',
      createdIp: '10.10.0.15',
      lastUsedUserAgent: 'Workshop iPad',
      lastUsedIp: '10.10.0.15',
    });
    expect(createArgs.data.tokenHash).toBe(
      createHash('sha256').update('plain-refresh-token').digest('hex'),
    );
    expect(createArgs.data.tokenHash).not.toBe('plain-refresh-token');
    expect(createArgs.data.tokenFamilyId).toEqual(expect.any(String));
  });

  it('reuses an existing token family when a replacement session is created', async () => {
    prisma.authSession.create.mockResolvedValue({ id: 'session-2' });

    await service.createSession({
      userId: '6f752649-f1a7-4fb0-b8da-b1bf9d7c77c6',
      refreshToken: 'rotated-refresh-token',
      expiresAt: new Date('2026-08-13T00:00:00.000Z'),
      tokenFamilyId: 'family-keep',
    });

    expect(prisma.authSession.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tokenFamilyId: 'family-keep',
      }),
    });
  });

  it('looks up only active, unexpired sessions by the hashed token value', async () => {
    prisma.authSession.findFirst.mockResolvedValue({ id: 'session-3' });
    const now = new Date('2026-07-13T16:00:00.000Z');

    await service.findActiveSessionByToken('plain-refresh-token', now);

    expect(prisma.authSession.findFirst).toHaveBeenCalledWith({
      where: {
        tokenHash: createHash('sha256')
          .update('plain-refresh-token')
          .digest('hex'),
        consumedAt: null,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      include: {
        user: {
          include: {
            role: {
              select: { name: true },
            },
          },
        },
      },
    });
  });

  it('creates distinct session families for unrelated logins', async () => {
    prisma.authSession.create.mockResolvedValue({ id: 'session-4' });
    const familySpy = jest
      .spyOn(globalThis.crypto, 'randomUUID')
      .mockReturnValueOnce('family-a')
      .mockReturnValueOnce('family-b');

    await service.createSession({
      userId: randomUUID(),
      refreshToken: 'token-a',
      expiresAt: new Date('2026-08-14T00:00:00.000Z'),
    });

    await service.createSession({
      userId: randomUUID(),
      refreshToken: 'token-b',
      expiresAt: new Date('2026-08-15T00:00:00.000Z'),
    });

    expect(prisma.authSession.create.mock.calls[0]?.[0]).toEqual({
      data: expect.objectContaining({ tokenFamilyId: 'family-a' }),
    });
    expect(prisma.authSession.create.mock.calls[1]?.[0]).toEqual({
      data: expect.objectContaining({ tokenFamilyId: 'family-b' }),
    });

    familySpy.mockRestore();
  });
});
