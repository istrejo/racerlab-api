import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { QuotesOverviewController } from './quotes-overview.controller';
import { QuotesController } from './quotes.controller';
import { QuotesService } from './quotes.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [QuotesOverviewController, QuotesController],
  providers: [QuotesService],
  exports: [QuotesService],
})
export class QuotesModule {}
