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

type JwtPayload = {
  sub?: unknown;
};

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
    if (!this.isValidSubject(payload.sub)) {
      throw new UnauthorizedException('Invalid token subject.');
    }

    try {
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: { role: { select: { name: true } } },
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedException('User is no longer active.');
      }

      return {
        id: user.id,
        email: user.email,
        role: user.role.name,
        isActive: true,
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

  private isValidSubject(subject: unknown): subject is string {
    return typeof subject === 'string' && UUID_SUBJECT_PATTERN.test(subject);
  }
}
