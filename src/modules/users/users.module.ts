import { Module } from '@nestjs/common';
import { PasswordHasherService } from '../../common/security/password-hasher.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [PrismaModule],
  controllers: [UsersController],
  providers: [UsersService, PasswordHasherService],
  exports: [UsersService],
})
export class UsersModule {}
