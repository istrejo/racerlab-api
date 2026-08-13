import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { getAuthConfig } from '../../config/auth.config';
import { PrismaService } from '../../prisma/prisma.service';
import type { JwtPayload } from './model/jwt-payload.model';

const UUID_SUBJECT_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(private readonly prisma: PrismaService) {
    const authConfig = getAuthConfig();

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: authConfig.jwtSecret,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    if (
      !this.isValidUuid(payload.sub) ||
      !this.isValidUuid(payload.sid) ||
      !this.hasValidWorkshopClaims(payload)
    ) {
      throw new UnauthorizedException('Invalid access token.');
    }

    try {
      const now = new Date();
      const session = await this.prisma.authSession.findFirst({
        where: {
          id: payload.sid,
          userId: payload.sub,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              isActive: true,
              mustChangePassword: true,
            },
          },
          activeMembership: {
            include: {
              role: { select: { name: true } },
              workshop: { select: { id: true } },
            },
          },
        },
      });

      if (!session?.user.isActive) {
        throw new UnauthorizedException('Invalid access token.');
      }

      const membership = session.activeMembership;

      if (!membership) {
        if (payload.mid !== undefined || payload.wid !== undefined) {
          throw new UnauthorizedException('Invalid access token.');
        }

        return {
          id: session.user.id,
          email: session.user.email,
          isActive: true,
          mustChangePassword: session.user.mustChangePassword,
          sessionId: session.id,
        };
      }

      if (
        !membership.isActive ||
        membership.id !== payload.mid ||
        membership.workshopId !== payload.wid
      ) {
        throw new UnauthorizedException('Invalid access token.');
      }

      return {
        id: session.user.id,
        email: session.user.email,
        isActive: true,
        mustChangePassword: session.user.mustChangePassword,
        sessionId: session.id,
        membershipId: membership.id,
        workshopId: membership.workshopId,
        role: membership.role.name,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      this.logger.error(
        'JWT user revalidation failed due to an internal dependency.',
      );
      throw new ServiceUnavailableException(
        'Authentication service temporarily unavailable.',
      );
    }
  }

  private hasValidWorkshopClaims(payload: JwtPayload): boolean {
    const hasWorkshopId = payload.wid !== undefined;
    const hasMembershipId = payload.mid !== undefined;

    return (
      (!hasWorkshopId && !hasMembershipId) ||
      (hasWorkshopId &&
        hasMembershipId &&
        this.isValidUuid(payload.wid) &&
        this.isValidUuid(payload.mid))
    );
  }

  private isValidUuid(value: unknown): value is string {
    return typeof value === 'string' && UUID_SUBJECT_PATTERN.test(value);
  }
}
