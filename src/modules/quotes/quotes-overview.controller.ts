import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import type { WorkshopContext } from '../../common/auth/workshop-context';
import { CurrentWorkshop } from '../../common/decorators/current-workshop.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { WorkshopContextGuard } from '../../common/guards/workshop-context.guard';
import { ListQuotesQueryDto } from './dto/list-quotes-query.dto';
import { QuotePageResponseDto } from './dto/quote-page-response.dto';
import { QuotesService } from './quotes.service';

const QUOTE_READ_ROLES = [
  UserRole.ADMIN,
  UserRole.MANAGER,
  UserRole.ADVISOR,
  UserRole.TECHNICIAN,
] as const;

@ApiTags('quotes')
@ApiBearerAuth('bearer')
@ApiBadRequestResponse({ description: 'Request validation failed.' })
@ApiUnauthorizedResponse({ description: 'Authentication is required.' })
@ApiForbiddenResponse({
  description: 'The active workshop role cannot perform this operation.',
})
@UseGuards(JwtAuthGuard, WorkshopContextGuard, RolesGuard)
@Controller('quotes')
export class QuotesOverviewController {
  constructor(private readonly quotesService: QuotesService) {}

  @Get()
  @Roles(...QUOTE_READ_ROLES)
  @ApiOperation({ summary: 'List quotes across the active workshop' })
  @ApiOkResponse({ type: QuotePageResponseDto })
  list(
    @CurrentWorkshop() context: WorkshopContext,
    @Query() query: ListQuotesQueryDto,
  ): Promise<QuotePageResponseDto> {
    return this.quotesService.listForWorkshop(context, query);
  }
}
