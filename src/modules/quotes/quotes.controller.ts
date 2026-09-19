import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { WorkshopContext } from '../../common/auth/workshop-context';
import {
  WORKSHOP_RESOURCE_READ_ROLES,
  WORKSHOP_RESOURCE_WRITE_ROLES,
} from '../../common/auth/workshop-role-policy';
import { CurrentWorkshop } from '../../common/decorators/current-workshop.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { WorkshopContextGuard } from '../../common/guards/workshop-context.guard';
import { ChangeQuoteStatusDto } from './dto/change-quote-status.dto';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { QuoteResponseDto } from './dto/quote-response.dto';
import { UpdateQuoteDto } from './dto/update-quote.dto';
import { QuotesService } from './quotes.service';

@ApiTags('quotes')
@ApiBearerAuth('bearer')
@ApiBadRequestResponse({ description: 'Request validation failed.' })
@ApiUnauthorizedResponse({ description: 'Authentication is required.' })
@ApiForbiddenResponse({
  description: 'The active workshop role cannot perform this operation.',
})
@UseGuards(JwtAuthGuard, WorkshopContextGuard, RolesGuard)
@Controller('service-orders/:serviceOrderId/quotes')
export class QuotesController {
  constructor(private readonly quotesService: QuotesService) {}

  @Get()
  @Roles(...WORKSHOP_RESOURCE_READ_ROLES)
  @ApiOperation({ summary: 'List quotes for a service order' })
  @ApiOkResponse({ type: [QuoteResponseDto] })
  @ApiNotFoundResponse({ description: 'Service order not found.' })
  list(
    @CurrentWorkshop() context: WorkshopContext,
    @Param('serviceOrderId', ParseUUIDPipe) serviceOrderId: string,
  ): Promise<QuoteResponseDto[]> {
    return this.quotesService.list(context, serviceOrderId);
  }

  @Get(':id')
  @Roles(...WORKSHOP_RESOURCE_READ_ROLES)
  @ApiOperation({ summary: 'Get a single quote' })
  @ApiOkResponse({ type: QuoteResponseDto })
  @ApiNotFoundResponse({ description: 'Quote not found.' })
  findOne(
    @CurrentWorkshop() context: WorkshopContext,
    @Param('serviceOrderId', ParseUUIDPipe) serviceOrderId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<QuoteResponseDto> {
    return this.quotesService.findOne(context, serviceOrderId, id);
  }

  @Post()
  @Roles(...WORKSHOP_RESOURCE_WRITE_ROLES)
  @ApiOperation({ summary: 'Create a draft quote for a service order' })
  @ApiCreatedResponse({ type: QuoteResponseDto })
  @ApiNotFoundResponse({ description: 'Service order not found.' })
  @ApiConflictResponse({
    description:
      'The service order already has a quote or is not in a quotable stage.',
  })
  create(
    @CurrentWorkshop() context: WorkshopContext,
    @Param('serviceOrderId', ParseUUIDPipe) serviceOrderId: string,
    @Body() dto: CreateQuoteDto,
  ): Promise<QuoteResponseDto> {
    return this.quotesService.create(context, serviceOrderId, dto);
  }

  @Post(':id/versions')
  @Roles(...WORKSHOP_RESOURCE_WRITE_ROLES)
  @ApiOperation({
    summary: 'Clone the latest eligible quote into the next draft version',
  })
  @ApiCreatedResponse({ type: QuoteResponseDto })
  @ApiNotFoundResponse({ description: 'Service order or quote not found.' })
  @ApiConflictResponse({
    description:
      'The quote is not the latest eligible version, a draft already exists, or the service order is not in a quotable stage.',
  })
  createVersion(
    @CurrentWorkshop() context: WorkshopContext,
    @Param('serviceOrderId', ParseUUIDPipe) serviceOrderId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<QuoteResponseDto> {
    return this.quotesService.createVersion(context, serviceOrderId, id);
  }

  @Patch(':id')
  @Roles(...WORKSHOP_RESOURCE_WRITE_ROLES)
  @ApiOperation({ summary: 'Update a draft quote (items, discount, tax)' })
  @ApiOkResponse({ type: QuoteResponseDto })
  @ApiNotFoundResponse({ description: 'Quote not found.' })
  @ApiConflictResponse({ description: 'Only draft quotes can be edited.' })
  update(
    @CurrentWorkshop() context: WorkshopContext,
    @Param('serviceOrderId', ParseUUIDPipe) serviceOrderId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateQuoteDto,
  ): Promise<QuoteResponseDto> {
    return this.quotesService.update(context, serviceOrderId, id, dto);
  }

  @Patch(':id/status')
  @Roles(...WORKSHOP_RESOURCE_WRITE_ROLES)
  @ApiOperation({ summary: 'Transition a quote to a new status' })
  @ApiOkResponse({ type: QuoteResponseDto })
  @ApiNotFoundResponse({ description: 'Quote not found.' })
  @ApiBadRequestResponse({ description: 'Status transition not allowed.' })
  @ApiConflictResponse({
    description:
      'Another quote is already active or approved for this service order.',
  })
  changeStatus(
    @CurrentWorkshop() context: WorkshopContext,
    @Param('serviceOrderId', ParseUUIDPipe) serviceOrderId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeQuoteStatusDto,
  ): Promise<QuoteResponseDto> {
    return this.quotesService.changeStatus(context, serviceOrderId, id, dto);
  }
}
