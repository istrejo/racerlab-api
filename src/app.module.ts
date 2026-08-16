import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { CustomersModule } from './modules/customers/customers.module';
import { DiagnosesModule } from './modules/diagnoses/diagnoses.module';
import { MembershipsModule } from './modules/memberships/memberships.module';
import { QuotesModule } from './modules/quotes/quotes.module';
import { ServiceOrdersModule } from './modules/service-orders/service-orders.module';
import { VehiclesModule } from './modules/vehicles/vehicles.module';
import { WorkshopsModule } from './modules/workshops/workshops.module';

@Module({
  imports: [
    HealthModule,
    AuthModule,
    WorkshopsModule,
    MembershipsModule,
    CustomersModule,
    VehiclesModule,
    ServiceOrdersModule,
    DiagnosesModule,
    QuotesModule,
  ],
})
export class AppModule {}
