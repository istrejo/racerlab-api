import { JwtService } from '@nestjs/jwt';
import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { PasswordHasherService } from '../../common/security/password-hasher.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordHasher: PasswordHasherService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto): Promise<LoginResponseDto> {
    try {
      const normalizedEmail = this.normalizeEmail(dto.email);
      const user = await this.prisma.user.findUnique({
        where: { email: normalizedEmail },
        include: { role: true },
      });

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

      const accessToken = await this.jwtService.signAsync({ sub: user.id });

      return {
        accessToken,
        tokenType: 'Bearer',
      };
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

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }
}
