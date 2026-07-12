import { JwtModule } from '@nestjs/jwt';
import { Module } from '@nestjs/common';
import { PasswordHasherService } from '../../common/security/password-hasher.service';
import { getAuthConfig } from '../../config/auth.config';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [
    PrismaModule,
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
  providers: [AuthService, PasswordHasherService],
  exports: [AuthService],
})
export class AuthModule {}
