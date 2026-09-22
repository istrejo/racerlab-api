import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
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
  INVENTORY_READ_ROLES,
  INVENTORY_WRITE_ROLES,
} from '../../common/auth/workshop-role-policy';
import { CurrentWorkshop } from '../../common/decorators/current-workshop.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { WorkshopContextGuard } from '../../common/guards/workshop-context.guard';
import { CreateInventoryMovementDto } from './dto/create-inventory-movement.dto';
import { InventoryMovementPageResponseDto } from './dto/inventory-movement-page-response.dto';
import { InventoryMovementResponseDto } from './dto/inventory-movement-response.dto';
import { ListInventoryMovementsQueryDto } from './dto/list-inventory-movements-query.dto';
import { InventoryMovementsService } from './inventory-movements.service';

@ApiTags('inventory')
@ApiBearerAuth('bearer')
@ApiBadRequestResponse({ description: 'Request validation failed.' })
@ApiUnauthorizedResponse({ description: 'Authentication is required.' })
@ApiForbiddenResponse({
  description: 'The active workshop role cannot perform this operation.',
})
@UseGuards(JwtAuthGuard, WorkshopContextGuard, RolesGuard)
@Controller('inventory/products/:productId/movements')
export class InventoryMovementsController {
  constructor(private readonly movementsService: InventoryMovementsService) {}

  @Get()
  @Roles(...INVENTORY_READ_ROLES)
  @ApiOperation({ summary: 'List stock movements of a product, newest first' })
  @ApiOkResponse({ type: InventoryMovementPageResponseDto })
  @ApiNotFoundResponse({ description: 'Inventory product not found.' })
  list(
    @CurrentWorkshop() context: WorkshopContext,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Query() query: ListInventoryMovementsQueryDto,
  ): Promise<InventoryMovementPageResponseDto> {
    return this.movementsService.list(context, productId, query);
  }

  @Post()
  @Roles(...INVENTORY_WRITE_ROLES)
  @ApiOperation({
    summary:
      'Record a manual stock movement (INBOUND, OUTBOUND, RETURN, or ADJUSTMENT)',
  })
  @ApiCreatedResponse({ type: InventoryMovementResponseDto })
  @ApiNotFoundResponse({
    description: 'Inventory product or service order not found.',
  })
  @ApiConflictResponse({
    description:
      'The product is inactive or the movement would make stock negative.',
  })
  create(
    @CurrentWorkshop() context: WorkshopContext,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() dto: CreateInventoryMovementDto,
  ): Promise<InventoryMovementResponseDto> {
    return this.movementsService.create(context, productId, dto);
  }
}
