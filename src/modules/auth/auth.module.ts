import { JwtModule } from '@nestjs/jwt';
import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PasswordHasherService } from '../../common/security/password-hasher.service';
import { getAuthConfig } from '../../config/auth.config';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    PrismaModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      useFactory: () => {
        const authConfig = getAuthConfig();

        return {
          secret: authConfig.jwtSecret,
          signOptions: {
            expiresIn: authConfig.accessTokenTtl as never,
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    JwtAuthGuard,
    RolesGuard,
    PasswordHasherService,
  ],
  exports: [JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
