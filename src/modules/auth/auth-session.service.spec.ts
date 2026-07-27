/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { createHash } from 'node:crypto';
import { AuthSessionService } from './auth-session.service';

describe('AuthSessionService tenant context', () => {
  const prisma = {
    authSession: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
  };
  const service = new AuthSessionService(prisma as never);

  it('persists the active membership and only a hash of the refresh token', async () => {
    prisma.authSession.create.mockResolvedValue({ id: 'session-id' });

    await service.createSession({
      userId: 'user-id',
      activeMembershipId: 'membership-id',
      refreshToken: 'plain-refresh-token',
      expiresAt: new Date('2026-08-26T00:00:00.000Z'),
    });

    const call = prisma.authSession.create.mock.calls[0]?.[0] as unknown as {
      data: {
        userId: string;
        activeMembershipId?: string;
        tokenHash: string;
      };
    };

    expect(call.data).toMatchObject({
      userId: 'user-id',
      activeMembershipId: 'membership-id',
      tokenHash: createHash('sha256')
        .update('plain-refresh-token')
        .digest('hex'),
    });
  });

  it('uses the pre-signed session id and membership when issuing a session', async () => {
    prisma.authSession.create.mockResolvedValue({ id: 'signed-session-id' });

    await service.issueSession({
      sessionId: 'signed-session-id',
      userId: 'user-id',
      activeMembershipId: 'membership-id',
    });

    expect(prisma.authSession.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: 'signed-session-id',
        userId: 'user-id',
        activeMembershipId: 'membership-id',
      }),
    });
  });

  it('resolves user and active membership context for refresh', async () => {
    await service.findSessionByToken('plain-refresh-token');

    const call = prisma.authSession.findUnique.mock
      .calls[0]?.[0] as unknown as {
      include: {
        user?: unknown;
        activeMembership?: unknown;
      };
    };

    expect(call.include.user).toBeDefined();
    expect(call.include.activeMembership).toBeDefined();
  });
});
