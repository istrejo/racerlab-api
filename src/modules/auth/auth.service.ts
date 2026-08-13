import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { PasswordHasherService } from '../../common/security/password-hasher.service';
import { normalizeEmail } from '../../common/utils/email-normalizer';
import { PrismaService } from '../../prisma/prisma.service';
import { ActiveWorkshopResponseDto } from './dto/active-workshop-response.dto';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { MeResponseDto } from './dto/me-response.dto';
import { SignupDto } from './dto/signup.dto';
import type { ActiveMembershipContext } from './model/active-membership-context.model';
import type { AuthRequestContext } from './model/auth-request-context.model';
import type { AuthSessionResponse } from './model/auth-session.model';
import { AuthSessionService } from './services/session/session';
import { AuthTokenService } from './services/token/token';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordHasher: PasswordHasherService,
    private readonly authSessionService: AuthSessionService,
    private readonly authTokenService: AuthTokenService,
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
          select: {
            id: true,
            name: true,
            email: true,
            mustChangePassword: true,
          },
        });

        return this.issueAuthenticatedSession(
          user,
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
        user,
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

      const issuedSession = await this.authSessionService.rotateRefreshToken(
        refreshToken,
        context,
      );
      const session = issuedSession.session;

      const activeMembership =
        session.activeMembership?.isActive === true
          ? session.activeMembership
          : null;
      const accessToken = await this.authTokenService.signAccessToken(
        session.userId,
        session.id,
        activeMembership,
      );

      return this.toSessionResponse(
        accessToken,
        issuedSession,
        activeMembership,
        session.user,
      );
    } catch (error) {
      this.rethrowAuthError(error, 'refresh');
    }
  }

  async selectWorkshop(
    user: AuthenticatedUser,
    workshopId: string,
  ): Promise<LoginResponseDto> {
    try {
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
        throw new UnauthorizedException(
          'Workshop membership is not available.',
        );
      }

      return this.activateMembershipForSession(user, membership);
    } catch (error) {
      this.rethrowAuthError(error, 'select workshop');
    }
  }

  async getMe(user: AuthenticatedUser): Promise<MeResponseDto> {
    try {
      // JwtStrategy already validated the session, user activity, and
      // membership. Here we only fetch profile fields not present in the
      // access token (user name, membership display profile) using two
      // lightweight parallel queries instead of re-querying the full session.
      const [identity, membership] = await Promise.all([
        this.prisma.user.findUnique({
          where: { id: user.id, isActive: true },
          select: {
            id: true,
            name: true,
            email: true,
            mustChangePassword: true,
          },
        }),
        user.membershipId
          ? this.prisma.membership.findFirst({
              where: {
                id: user.membershipId,
                userId: user.id,
                isActive: true,
              },
              select: {
                id: true,
                workshopId: true,
                displayName: true,
                phone: true,
                address: true,
                role: { select: { name: true } },
                workshop: { select: { id: true, name: true } },
              },
            })
          : null,
      ]);

      if (!identity) {
        throw new UnauthorizedException('Invalid access session.');
      }

      if (user.membershipId && !membership) {
        throw new UnauthorizedException('Invalid access session.');
      }

      return {
        user: {
          id: identity.id,
          name: identity.name,
          email: identity.email,
        },
        activeWorkshop: membership
          ? {
              workshopId: membership.workshopId,
              membershipId: membership.id,
              name: membership.workshop.name,
              role: membership.role.name,
              profile: {
                displayName: membership.displayName,
                phone: membership.phone,
                address: membership.address,
              },
            }
          : null,
        requiresPasswordChange: identity.mustChangePassword,
      };
    } catch (error) {
      this.rethrowAuthError(error, 'get current session');
    }
  }

  async activateMembershipForSession(
    user: Pick<AuthenticatedUser, 'id' | 'sessionId' | 'mustChangePassword'>,
    membership: ActiveMembershipContext,
  ): Promise<LoginResponseDto> {
    try {
      const updated = await this.prisma.authSession.updateMany({
        where: {
          id: user.sessionId,
          userId: user.id,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { activeMembershipId: membership.id },
      });

      if (updated.count !== 1) {
        throw new UnauthorizedException('Invalid access session.');
      }

      const identity = await this.prisma.user.findUniqueOrThrow({
        where: { id: user.id },
        select: { id: true, name: true, email: true },
      });
      const accessToken = await this.authTokenService.signAccessToken(
        user.id,
        user.sessionId,
        membership,
      );

      return this.toTokenResponse(
        accessToken,
        membership,
        identity,
        user.mustChangePassword,
      );
    } catch (error) {
      this.rethrowAuthError(error, 'activate membership');
    }
  }

  async issueAuthenticatedSession(
    user: {
      id: string;
      name: string;
      email: string;
      mustChangePassword: boolean;
    },
    activeMembershipId?: string,
    context: AuthRequestContext = {},
    knownMembership?: ActiveMembershipContext | null,
    knownMustChangePassword?: boolean,
    prisma?: Prisma.TransactionClient,
  ): Promise<AuthSessionResponse> {
    const membership =
      knownMembership === undefined
        ? await this.findActiveMembership(user.id, activeMembershipId)
        : knownMembership;
    const mustChangePassword =
      knownMustChangePassword ??
      (
        await (prisma ?? this.prisma).user.findUniqueOrThrow({
          where: { id: user.id },
          select: { mustChangePassword: true },
        })
      ).mustChangePassword;

    const issuedSession = await this.authSessionService.issueSession({
      prisma,
      userId: user.id,
      activeMembershipId: membership?.id,
      context,
    });
    const accessToken = await this.authTokenService.signAccessToken(
      user.id,
      issuedSession.session.id,
      membership,
    );

    return this.toSessionResponse(accessToken, issuedSession, membership, {
      ...user,
      mustChangePassword,
    });
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
      await tx.refreshToken.updateMany({
        where: {
          session: { userId: user.id, id: { not: user.sessionId } },
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
      await this.authSessionService.revokeByRefreshToken(refreshToken, context);
    } catch (error) {
      this.rethrowDependencyError(error, 'logout');
    }
  }

  async logoutAll(userId: string): Promise<void> {
    try {
      await this.authSessionService.revokeAllUserSessions(userId);
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

  private toSessionResponse(
    accessToken: string,
    issuedSession: {
      refreshToken: string;
      expiresAt: Date;
    },
    membership: ActiveMembershipContext | null,
    user: {
      id: string;
      name: string;
      email: string;
      mustChangePassword: boolean;
    },
  ): AuthSessionResponse {
    return {
      ...this.toTokenResponse(
        accessToken,
        membership,
        user,
        user.mustChangePassword,
      ),
      refreshToken: issuedSession.refreshToken,
      refreshTokenExpiresAt: issuedSession.expiresAt,
    };
  }

  private toTokenResponse(
    accessToken: string,
    membership: ActiveMembershipContext | null,
    user: { id: string; name: string; email: string },
    mustChangePassword: boolean,
  ): LoginResponseDto {
    return {
      accessToken,
      tokenType: 'Bearer',
      user,
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
      profile: {
        displayName: membership.displayName,
        phone: membership.phone,
        address: membership.address,
      },
    };
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
