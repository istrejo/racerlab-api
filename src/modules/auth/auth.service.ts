import { JwtService } from '@nestjs/jwt';
import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PasswordHasherService } from '../../common/security/password-hasher.service';
import { normalizeEmail } from '../../common/utils/email-normalizer';
import { getAuthConfig } from '../../config/auth.config';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthSessionService } from './auth-session.service';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';

export type AuthRequestContext = {
  userAgent?: string;
  ipAddress?: string;
};

export type AuthSessionResponse = LoginResponseDto & {
  refreshToken: string;
  refreshTokenExpiresAt: Date;
};

type RefreshSessionRecord = Awaited<
  ReturnType<AuthSessionService['findSessionByToken']>
>;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly authConfig = getAuthConfig();

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordHasher: PasswordHasherService,
    private readonly jwtService: JwtService,
    private readonly authSessionService: AuthSessionService,
  ) {}

  async login(
    dto: LoginDto,
    context: AuthRequestContext = {},
  ): Promise<AuthSessionResponse> {
    try {
      const normalizedEmail = normalizeEmail(dto.email);
      const user = await this.findUserForLogin(normalizedEmail);

      if (!user || !user.isActive) {
        throw new UnauthorizedException('Invalid credentials.');
      }

      const passwordMatches = await this.passwordHasher.verify(
        dto.password,
        user.passwordHash,
      );

      if (!passwordMatches) {
        throw new UnauthorizedException('Invalid credentials.');
      }

      return this.issueLoginSession(user.id, context);
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      this.logger.error(
        'Authentication login failed due to an internal dependency.',
        error instanceof Error ? (error.stack ?? error.message) : String(error),
      );

      throw new ServiceUnavailableException(
        'Authentication service temporarily unavailable.',
      );
    }
  }

  async refresh(
    refreshToken?: string,
    context: AuthRequestContext = {},
  ): Promise<AuthSessionResponse> {
    try {
      if (!refreshToken) {
        throw new UnauthorizedException('Invalid refresh session.');
      }

      const session = await this.authSessionService.findSessionByToken(refreshToken);

      if (!session || !session.user.isActive) {
        throw new UnauthorizedException('Invalid refresh session.');
      }

      const now = new Date();

      if (
        session.consumedAt ||
        session.revokedAt ||
        session.expiresAt.getTime() <= now.getTime()
      ) {
        await this.revokeRefreshTokenFamily(session.tokenFamilyId, now);
        throw new UnauthorizedException('Invalid refresh session.');
      }

      const accessToken = await this.signAccessToken(session.userId);
      const issuedSession = await this.prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          const consumed = await tx.authSession.updateMany({
            where: {
              id: session.id,
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

          const replacement = await this.authSessionService.issueSession({
            prisma: tx,
            userId: session.userId,
            tokenFamilyId: session.tokenFamilyId,
            userAgent: context.userAgent,
            ipAddress: context.ipAddress,
            now,
          });

          await tx.authSession.update({
            where: { id: session.id },
            data: {
              replacedBySessionId: replacement.session.id,
            },
          });

          return replacement;
        },
      );

      if (!issuedSession) {
        await this.revokeRefreshTokenFamily(session.tokenFamilyId, now);
        throw new UnauthorizedException('Invalid refresh session.');
      }

      return this.toSessionResponse(accessToken, issuedSession);
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      this.logger.error(
        'Authentication refresh failed due to an internal dependency.',
        error instanceof Error ? (error.stack ?? error.message) : String(error),
      );

      throw new ServiceUnavailableException(
        'Authentication service temporarily unavailable.',
      );
    }
  }

  private async findUserForLogin(normalizedEmail: string) {
    const exactMatch = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { role: true },
    });

    if (exactMatch) {
      const duplicateMatches = await this.prisma.user.findMany({
        where: {
          email: {
            equals: normalizedEmail,
            mode: 'insensitive',
          },
        },
        include: { role: true },
        orderBy: [{ email: 'asc' }, { id: 'asc' }],
        take: 2,
      });

      if (duplicateMatches.length !== 1) {
        return null;
      }

      return exactMatch;
    }

    const compatibilityMatches = await this.prisma.user.findMany({
      where: {
        email: {
          equals: normalizedEmail,
          mode: 'insensitive',
        },
      },
      include: { role: true },
      orderBy: [{ email: 'asc' }, { id: 'asc' }],
      take: 2,
    });

    if (compatibilityMatches.length !== 1) {
      return null;
    }

    return compatibilityMatches[0];
  }

  private async issueLoginSession(
    userId: string,
    context: AuthRequestContext,
  ): Promise<AuthSessionResponse> {
    const [accessToken, issuedSession] = await Promise.all([
      this.signAccessToken(userId),
      this.authSessionService.issueSession({
        userId,
        userAgent: context.userAgent,
        ipAddress: context.ipAddress,
      }),
    ]);

    return this.toSessionResponse(accessToken, issuedSession);
  }

  private async signAccessToken(userId: string): Promise<string> {
    return this.jwtService.signAsync(
      { sub: userId },
      { expiresIn: this.authConfig.accessTokenTtl as never },
    );
  }

  private toSessionResponse(
    accessToken: string,
    issuedSession: {
      refreshToken: string;
      expiresAt: Date;
    },
  ): AuthSessionResponse {
    return {
      accessToken,
      tokenType: 'Bearer',
      refreshToken: issuedSession.refreshToken,
      refreshTokenExpiresAt: issuedSession.expiresAt,
    };
  }

  private async revokeRefreshTokenFamily(tokenFamilyId: string, revokedAt: Date) {
    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.authSession.updateMany({
        where: {
          tokenFamilyId,
          revokedAt: null,
        },
        data: {
          revokedAt,
        },
      });
    });
  }
}
