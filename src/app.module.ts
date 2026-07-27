import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { MembershipsModule } from './modules/memberships/memberships.module';
import { WorkshopsModule } from './modules/workshops/workshops.module';

@Module({
  imports: [HealthModule, AuthModule, WorkshopsModule, MembershipsModule],
})
export class AppModule {}
