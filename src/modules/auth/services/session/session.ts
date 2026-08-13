import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { getAuthConfig } from '../../../../config/auth.config';
import { PrismaService } from '../../../../prisma/prisma.service';
import type { AuthRequestContext } from '../../model/auth-request-context.model';
import type { IssueAuthSessionInput } from '../../model/auth-session.model';
import { AuthTokenService } from '../token/token';

const CONCURRENT_REFRESH_GRACE_MS = 5_000;

function resolveDurationMilliseconds(value: number | string): number {
  if (typeof value === 'number') {
    return value * 1000;
  }

  const match = /^(\d+)(ms|s|m|h|d|w|y)$/.exec(value);
  if (!match) {
    throw new Error('Invalid refresh token TTL configuration.');
  }

  const multipliers: Record<string, number> = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
    y: 365 * 24 * 60 * 60 * 1000,
  };

  return Number(match[1]) * multipliers[match[2]];
}

const refreshTokenInclude = {
  replacedBy: true,
  session: {
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          isActive: true,
          mustChangePassword: true,
        },
      },
      activeMembership: {
        include: {
          role: { select: { name: true } },
          workshop: { select: { id: true, name: true } },
        },
      },
    },
  },
} satisfies Prisma.RefreshTokenInclude;

@Injectable()
export class AuthSessionService {
  private readonly refreshTtlMs = resolveDurationMilliseconds(
    getAuthConfig().refreshTokenTtl,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: AuthTokenService,
  ) {}

  async issueSession(input: IssueAuthSessionInput) {
    const prisma = input.prisma ?? this.prisma;
    const now = input.now ?? new Date();
    const expiresAt = new Date(now.getTime() + this.refreshTtlMs);
    const refreshToken = this.tokenService.issueRefreshToken();
    const session = await prisma.authSession.create({
      data: {
        id: input.sessionId,
        userId: input.userId,
        activeMembershipId: input.activeMembershipId,
        expiresAt,
        createdUserAgent: input.context?.userAgent,
        createdIp: input.context?.ipAddress,
        lastUsedUserAgent: input.context?.userAgent,
        lastUsedIp: input.context?.ipAddress,
        refreshTokens: {
          create: {
            id: refreshToken.id,
            expiresAt,
            createdUserAgent: input.context?.userAgent,
            createdIp: input.context?.ipAddress,
            lastUsedUserAgent: input.context?.userAgent,
            lastUsedIp: input.context?.ipAddress,
          },
        },
      },
    });

    return {
      session,
      refreshToken: refreshToken.value,
      expiresAt,
    };
  }

  async rotateRefreshToken(
    refreshToken: string,
    context: AuthRequestContext = {},
    now = new Date(),
  ) {
    const tokenId = this.tokenService.parseRefreshToken(refreshToken);
    if (!tokenId) {
      throw this.invalidRefreshSession();
    }

    const storedToken = await this.findRefreshToken(tokenId);
    this.assertUsableSession(storedToken, now);

    if (storedToken.consumedAt) {
      return this.resolveConcurrentReplacement(storedToken, now);
    }

    if (
      storedToken.revokedAt ||
      storedToken.expiresAt.getTime() <= now.getTime()
    ) {
      throw this.invalidRefreshSession();
    }

    const replacement = this.tokenService.issueRefreshToken();
    const expiresAt = new Date(now.getTime() + this.refreshTtlMs);
    const rotated = await this.prisma.$transaction(async (tx) => {
      // Lock the stable session before its refresh token. Revocation follows the
      // same order, which prevents an avoidable session/token deadlock.
      const activeSession = await tx.authSession.updateMany({
        where: {
          id: storedToken.sessionId,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        data: {
          lastUsedUserAgent: context.userAgent,
          lastUsedIp: context.ipAddress,
        },
      });

      if (activeSession.count !== 1) {
        throw this.invalidRefreshSession();
      }

      const consumed = await tx.refreshToken.updateMany({
        where: {
          id: storedToken.id,
          consumedAt: null,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        data: {
          consumedAt: now,
          lastUsedUserAgent: context.userAgent,
          lastUsedIp: context.ipAddress,
        },
      });

      if (consumed.count !== 1) {
        return null;
      }

      await tx.refreshToken.create({
        data: {
          id: replacement.id,
          sessionId: storedToken.sessionId,
          expiresAt,
          createdUserAgent: context.userAgent,
          createdIp: context.ipAddress,
          lastUsedUserAgent: context.userAgent,
          lastUsedIp: context.ipAddress,
        },
      });
      await tx.refreshToken.update({
        where: { id: storedToken.id },
        data: { replacedByTokenId: replacement.id },
      });
      await tx.authSession.updateMany({
        where: { id: storedToken.sessionId },
        data: { expiresAt },
      });

      return replacement;
    });

    if (!rotated) {
      const concurrentNow = new Date();
      const concurrentToken = await this.findRefreshToken(tokenId);
      this.assertUsableSession(concurrentToken, concurrentNow);
      return this.resolveConcurrentReplacement(concurrentToken, concurrentNow);
    }

    return {
      session: storedToken.session,
      refreshToken: rotated.value,
      expiresAt,
    };
  }

  async revokeByRefreshToken(
    refreshToken: string | undefined,
    context: AuthRequestContext = {},
  ): Promise<void> {
    if (!refreshToken) {
      return;
    }

    const tokenId = this.tokenService.parseRefreshToken(refreshToken);
    if (!tokenId) {
      return;
    }

    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { id: tokenId },
      select: { sessionId: true },
    });
    if (!storedToken) {
      return;
    }

    await this.revokeSession(storedToken.sessionId, new Date(), context);
  }

  async revokeSession(
    sessionId: string,
    revokedAt = new Date(),
    context: AuthRequestContext = {},
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.authSession.updateMany({
        where: { id: sessionId, revokedAt: null },
        data: {
          revokedAt,
          lastUsedUserAgent: context.userAgent,
          lastUsedIp: context.ipAddress,
        },
      });
      await tx.refreshToken.updateMany({
        where: { sessionId, revokedAt: null },
        data: { revokedAt },
      });
    });
  }

  async revokeAllUserSessions(
    userId: string,
    revokedAt = new Date(),
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.authSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt },
      });
      await tx.refreshToken.updateMany({
        where: { session: { userId }, revokedAt: null },
        data: { revokedAt },
      });
    });
  }

  private findRefreshToken(tokenId: string) {
    return this.prisma.refreshToken.findUnique({
      where: { id: tokenId },
      include: refreshTokenInclude,
    });
  }

  private assertUsableSession(
    storedToken: Awaited<ReturnType<AuthSessionService['findRefreshToken']>>,
    now: Date,
  ): asserts storedToken is NonNullable<typeof storedToken> {
    if (
      !storedToken?.session.user.isActive ||
      storedToken.session.revokedAt ||
      storedToken.session.expiresAt.getTime() <= now.getTime()
    ) {
      throw this.invalidRefreshSession();
    }
  }

  private async resolveConcurrentReplacement(
    storedToken: NonNullable<
      Awaited<ReturnType<AuthSessionService['findRefreshToken']>>
    >,
    now: Date,
  ) {
    const consumedAgo = now.getTime() - storedToken.consumedAt!.getTime();
    const replacement = storedToken.replacedBy;

    if (
      consumedAgo >= 0 &&
      consumedAgo <= CONCURRENT_REFRESH_GRACE_MS &&
      replacement &&
      !replacement.revokedAt &&
      replacement.expiresAt.getTime() > now.getTime()
    ) {
      return {
        session: storedToken.session,
        refreshToken: this.tokenService.serializeRefreshToken(replacement.id),
        expiresAt: replacement.expiresAt,
      };
    }

    await this.revokeSession(storedToken.sessionId, now);
    throw this.invalidRefreshSession();
  }

  private invalidRefreshSession(): UnauthorizedException {
    return new UnauthorizedException('Invalid refresh session.');
  }
}
