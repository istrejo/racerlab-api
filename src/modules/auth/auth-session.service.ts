import { createHash, randomBytes } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { Injectable } from '@nestjs/common';
import { getAuthConfig } from '../../config/auth.config';
import { PrismaService } from '../../prisma/prisma.service';

export type CreateAuthSessionInput = {
  userId: string;
  refreshToken: string;
  expiresAt: Date;
  tokenFamilyId?: string;
  userAgent?: string;
  ipAddress?: string;
};

export type IssueAuthSessionInput = Omit<
  CreateAuthSessionInput,
  'refreshToken' | 'expiresAt'
> & {
  prisma?: Prisma.TransactionClient;
  now?: Date;
};

type PrismaSessionClient = PrismaService | Prisma.TransactionClient;

function resolveDurationMilliseconds(value: number | string): number {
  if (typeof value === 'number') {
    return value * 1000;
  }

  const match = /^(\d+)(ms|s|m|h|d|w|y)$/.exec(value);

  if (!match) {
    throw new Error('Invalid refresh token TTL configuration.');
  }

  const amount = Number(match[1]);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
    y: 365 * 24 * 60 * 60 * 1000,
  };

  return amount * multipliers[unit];
}

@Injectable()
export class AuthSessionService {
  constructor(private readonly prisma: PrismaService) {}

  async issueSession(input: IssueAuthSessionInput) {
    const refreshToken = randomBytes(48).toString('base64url');
    const ttlMs = resolveDurationMilliseconds(getAuthConfig().refreshTokenTtl);
    const now = input.now ?? new Date();
    const expiresAt = new Date(now.getTime() + ttlMs);
    const prisma = input.prisma ?? this.prisma;
    const session = await this.createSession(
      {
        userId: input.userId,
        refreshToken,
        expiresAt,
        tokenFamilyId: input.tokenFamilyId,
        userAgent: input.userAgent,
        ipAddress: input.ipAddress,
      },
      prisma,
    );

    return {
      refreshToken,
      expiresAt,
      session,
    };
  }

  async createSession(
    input: CreateAuthSessionInput,
    prisma: PrismaSessionClient = this.prisma,
  ) {
    const tokenFamilyId = input.tokenFamilyId ?? globalThis.crypto.randomUUID();

    return prisma.authSession.create({
      data: {
        userId: input.userId,
        tokenFamilyId,
        tokenHash: this.hashToken(input.refreshToken),
        expiresAt: input.expiresAt,
        createdUserAgent: input.userAgent,
        createdIp: input.ipAddress,
        lastUsedUserAgent: input.userAgent,
        lastUsedIp: input.ipAddress,
      },
    });
  }

  async findSessionByToken(refreshToken: string) {
    return this.prisma.authSession.findUnique({
      where: {
        tokenHash: this.hashToken(refreshToken),
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
  }

  async findActiveSessionByToken(refreshToken: string, now = new Date()) {
    return this.prisma.authSession.findFirst({
      where: {
        tokenHash: this.hashToken(refreshToken),
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
  }

  private hashToken(refreshToken: string): string {
    return createHash('sha256').update(refreshToken).digest('hex');
  }
}
