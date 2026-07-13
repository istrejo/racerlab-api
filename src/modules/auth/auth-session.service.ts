import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export type CreateAuthSessionInput = {
  userId: string;
  refreshToken: string;
  expiresAt: Date;
  tokenFamilyId?: string;
  userAgent?: string;
  ipAddress?: string;
};

@Injectable()
export class AuthSessionService {
  constructor(private readonly prisma: PrismaService) {}

  async createSession(input: CreateAuthSessionInput) {
    const tokenFamilyId = input.tokenFamilyId ?? globalThis.crypto.randomUUID();

    return this.prisma.authSession.create({
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
