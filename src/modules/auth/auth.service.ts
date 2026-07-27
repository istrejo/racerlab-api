import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import { Prisma, UserRole } from '@prisma/client';
import { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { PasswordHasherService } from '../../common/security/password-hasher.service';
import { normalizeEmail } from '../../common/utils/email-normalizer';
import { getAuthConfig } from '../../config/auth.config';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthSessionService } from './auth-session.service';
import { ActiveWorkshopResponseDto } from './dto/active-workshop-response.dto';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { SignupDto } from './dto/signup.dto';

export type AuthRequestContext = {
  userAgent?: string;
  ipAddress?: string;
};

export type AuthSessionResponse = LoginResponseDto & {
  refreshToken: string;
  refreshTokenExpiresAt: Date;
};

export type ActiveMembershipContext = {
  id: string;
  workshopId: string;
  role: { name: UserRole };
  workshop: { id: string; name: string };
};

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

  async signup(
    dto: SignupDto,
    context: AuthRequestContext = {},
  ): Promise<AuthSessionResponse> {
    try {
      const email = normalizeEmail(dto.email);
      const passwordHash = await this.passwordHasher.hash(dto.password);

      return await this.prisma.$transaction(async (tx) => {
        const existingUser = await tx.user.findFirst({
          where: {
            email: {
              equals: email,
              mode: 'insensitive',
            },
          },
          select: { id: true },
        });

        if (existingUser) {
          throw new ConflictException('Email is already registered.');
        }

        const user = await tx.user.create({
          data: {
            name: dto.name,
            email,
            passwordHash,
            isActive: true,
            mustChangePassword: false,
          },
          select: { id: true },
        });

        return this.issueAuthenticatedSession(
          user.id,
          undefined,
          context,
          null,
          false,
          tx,
        );
      });
    } catch (error) {
      if (
        error instanceof ConflictException ||
        this.isUniqueConstraintError(error)
      ) {
        throw new ConflictException('Email is already registered.');
      }

      this.rethrowDependencyError(error, 'signup');
    }
  }

  async login(
    dto: LoginDto,
    context: AuthRequestContext = {},
  ): Promise<AuthSessionResponse> {
    try {
      const normalizedEmail = normalizeEmail(dto.email);
      const user = await this.findUserForLogin(normalizedEmail);

      if (!user?.isActive) {
        throw new UnauthorizedException('Invalid credentials.');
      }

      const passwordMatches = await this.passwordHasher.verify(
        dto.password,
        user.passwordHash,
      );

      if (!passwordMatches) {
        throw new UnauthorizedException('Invalid credentials.');
      }

      const activeMembership =
        user.memberships.length === 1 ? user.memberships[0] : null;

      return this.issueAuthenticatedSession(
        user.id,
        activeMembership?.id,
        context,
        activeMembership,
        user.mustChangePassword,
      );
    } catch (error) {
      this.rethrowAuthError(error, 'login');
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

      const session =
        await this.authSessionService.findSessionByToken(refreshToken);

      if (!session?.user.isActive) {
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

      const activeMembership =
        session.activeMembership?.isActive === true
          ? session.activeMembership
          : null;
      const replacementSessionId = randomUUID();
      const accessToken = await this.signAccessToken(
        session.userId,
        replacementSessionId,
        activeMembership,
      );

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
            sessionId: replacementSessionId,
            userId: session.userId,
            activeMembershipId: activeMembership?.id,
            tokenFamilyId: session.tokenFamilyId,
            userAgent: context.userAgent,
            ipAddress: context.ipAddress,
            now,
          });

          await tx.authSession.update({
            where: { id: session.id },
            data: { replacedBySessionId: replacement.session.id },
          });

          return replacement;
        },
      );

      if (!issuedSession) {
        await this.revokeRefreshTokenFamily(session.tokenFamilyId, now);
        throw new UnauthorizedException('Invalid refresh session.');
      }

      return this.toSessionResponse(
        accessToken,
        issuedSession,
        activeMembership,
        session.user.mustChangePassword,
      );
    } catch (error) {
      this.rethrowAuthError(error, 'refresh');
    }
  }

  async selectWorkshop(
    user: AuthenticatedUser,
    workshopId: string,
  ): Promise<LoginResponseDto> {
    const membership = await this.prisma.membership.findFirst({
      where: {
        userId: user.id,
        workshopId,
        isActive: true,
      },
      include: {
        role: { select: { name: true } },
        workshop: { select: { id: true, name: true } },
      },
    });

    if (!membership) {
      throw new UnauthorizedException('Workshop membership is not available.');
    }

    return this.activateMembershipForSession(user, membership);
  }

  async activateMembershipForSession(
    user: Pick<AuthenticatedUser, 'id' | 'sessionId' | 'mustChangePassword'>,
    membership: ActiveMembershipContext,
  ): Promise<LoginResponseDto> {
    const accessToken = await this.signAccessToken(
      user.id,
      user.sessionId,
      membership,
    );
    const updated = await this.prisma.authSession.updateMany({
      where: {
        id: user.sessionId,
        userId: user.id,
        consumedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { activeMembershipId: membership.id },
    });

    if (updated.count !== 1) {
      throw new UnauthorizedException('Invalid access session.');
    }

    return this.toTokenResponse(
      accessToken,
      membership,
      user.mustChangePassword,
    );
  }

  async issueAuthenticatedSession(
    userId: string,
    activeMembershipId?: string,
    context: AuthRequestContext = {},
    knownMembership?: ActiveMembershipContext | null,
    knownMustChangePassword?: boolean,
    prisma?: Prisma.TransactionClient,
  ): Promise<AuthSessionResponse> {
    const membership =
      knownMembership === undefined
        ? await this.findActiveMembership(userId, activeMembershipId)
        : knownMembership;
    const mustChangePassword =
      knownMustChangePassword ??
      (
        await this.prisma.user.findUniqueOrThrow({
          where: { id: userId },
          select: { mustChangePassword: true },
        })
      ).mustChangePassword;

    const sessionId = randomUUID();
    const accessToken = await this.signAccessToken(
      userId,
      sessionId,
      membership,
    );
    const issuedSession = await this.authSessionService.issueSession({
      prisma,
      sessionId,
      userId,
      activeMembershipId: membership?.id,
      userAgent: context.userAgent,
      ipAddress: context.ipAddress,
    });

    return this.toSessionResponse(
      accessToken,
      issuedSession,
      membership,
      mustChangePassword,
    );
  }

  async changePassword(
    user: AuthenticatedUser,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const identity = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        passwordHash: true,
        isActive: true,
      },
    });

    if (
      !identity?.isActive ||
      !(await this.passwordHasher.verify(
        currentPassword,
        identity.passwordHash,
      ))
    ) {
      throw new UnauthorizedException('Current password is invalid.');
    }

    if (await this.passwordHasher.verify(newPassword, identity.passwordHash)) {
      throw new BadRequestException(
        'The new password must differ from the current password.',
      );
    }

    const passwordHash = await this.passwordHasher.hash(newPassword);
    const revokedAt = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          mustChangePassword: false,
        },
      });

      await tx.authSession.updateMany({
        where: {
          userId: user.id,
          id: { not: user.sessionId },
          revokedAt: null,
        },
        data: { revokedAt },
      });
    });

    this.logger.log(
      `User ${user.id} changed password; other active sessions were revoked.`,
    );
  }

  async logout(
    refreshToken?: string,
    context: AuthRequestContext = {},
  ): Promise<void> {
    try {
      if (!refreshToken) {
        return;
      }

      const session =
        await this.authSessionService.findSessionByToken(refreshToken);

      if (
        !session?.user.isActive ||
        session.consumedAt ||
        session.revokedAt ||
        session.expiresAt.getTime() <= Date.now()
      ) {
        return;
      }

      await this.prisma.authSession.updateMany({
        where: {
          id: session.id,
          consumedAt: null,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: {
          revokedAt: new Date(),
          lastUsedUserAgent: context.userAgent,
          lastUsedIp: context.ipAddress,
        },
      });
    } catch (error) {
      this.rethrowDependencyError(error, 'logout');
    }
  }

  async logoutAll(userId: string): Promise<void> {
    try {
      const revokedAt = new Date();

      await this.prisma.authSession.updateMany({
        where: {
          userId,
          revokedAt: null,
          expiresAt: { gt: revokedAt },
        },
        data: { revokedAt },
      });
    } catch (error) {
      this.rethrowDependencyError(error, 'logout-all');
    }
  }

  private async findUserForLogin(normalizedEmail: string) {
    const matches = await this.prisma.user.findMany({
      where: {
        email: {
          equals: normalizedEmail,
          mode: 'insensitive',
        },
      },
      include: {
        memberships: {
          where: { isActive: true },
          include: {
            role: { select: { name: true } },
            workshop: { select: { id: true, name: true } },
          },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        },
      },
      orderBy: [{ email: 'asc' }, { id: 'asc' }],
      take: 2,
    });

    return matches.length === 1 ? matches[0] : null;
  }

  private async findActiveMembership(
    userId: string,
    membershipId?: string,
  ): Promise<ActiveMembershipContext | null> {
    if (!membershipId) {
      return null;
    }

    return this.prisma.membership.findFirst({
      where: {
        id: membershipId,
        userId,
        isActive: true,
      },
      include: {
        role: { select: { name: true } },
        workshop: { select: { id: true, name: true } },
      },
    });
  }

  private async signAccessToken(
    userId: string,
    sessionId: string,
    membership: ActiveMembershipContext | null,
  ): Promise<string> {
    return this.jwtService.signAsync(
      {
        sub: userId,
        sid: sessionId,
        ...(membership
          ? {
              wid: membership.workshopId,
              mid: membership.id,
            }
          : {}),
      },
      { expiresIn: this.authConfig.accessTokenTtl as never },
    );
  }

  private toSessionResponse(
    accessToken: string,
    issuedSession: {
      refreshToken: string;
      expiresAt: Date;
    },
    membership: ActiveMembershipContext | null,
    mustChangePassword: boolean,
  ): AuthSessionResponse {
    return {
      ...this.toTokenResponse(accessToken, membership, mustChangePassword),
      refreshToken: issuedSession.refreshToken,
      refreshTokenExpiresAt: issuedSession.expiresAt,
    };
  }

  private toTokenResponse(
    accessToken: string,
    membership: ActiveMembershipContext | null,
    mustChangePassword: boolean,
  ): LoginResponseDto {
    return {
      accessToken,
      tokenType: 'Bearer',
      activeWorkshop: this.toActiveWorkshop(membership),
      requiresWorkshopSelection: membership === null,
      requiresPasswordChange: mustChangePassword,
    };
  }

  private toActiveWorkshop(
    membership: ActiveMembershipContext | null,
  ): ActiveWorkshopResponseDto | null {
    if (!membership) {
      return null;
    }

    return {
      workshopId: membership.workshopId,
      membershipId: membership.id,
      name: membership.workshop.name,
      role: membership.role.name,
    };
  }

  private async revokeRefreshTokenFamily(
    tokenFamilyId: string,
    revokedAt: Date,
  ): Promise<void> {
    await this.prisma.authSession.updateMany({
      where: {
        tokenFamilyId,
        revokedAt: null,
      },
      data: { revokedAt },
    });
  }

  private rethrowAuthError(error: unknown, operation: string): never {
    if (error instanceof UnauthorizedException) {
      throw error;
    }

    this.rethrowDependencyError(error, operation);
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    );
  }

  private rethrowDependencyError(error: unknown, operation: string): never {
    this.logger.error(
      `Authentication ${operation} failed due to an internal dependency.`,
      error instanceof Error ? (error.stack ?? error.message) : String(error),
    );
    throw new ServiceUnavailableException(
      'Authentication service temporarily unavailable.',
    );
  }
}
