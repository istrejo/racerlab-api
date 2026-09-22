import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { CreateInventoryProductDto } from './dto/create-inventory-product.dto';
import { InventoryProductPageResponseDto } from './dto/inventory-product-page-response.dto';
import { InventoryProductResponseDto } from './dto/inventory-product-response.dto';
import { ListInventoryProductsQueryDto } from './dto/list-inventory-products-query.dto';
import { UpdateInventoryProductDto } from './dto/update-inventory-product.dto';
import { InventoryProductsService } from './inventory-products.service';

@ApiTags('inventory')
@ApiBearerAuth('bearer')
@ApiBadRequestResponse({ description: 'Request validation failed.' })
@ApiUnauthorizedResponse({ description: 'Authentication is required.' })
@ApiForbiddenResponse({
  description: 'The active workshop role cannot perform this operation.',
})
@UseGuards(JwtAuthGuard, WorkshopContextGuard, RolesGuard)
@Controller('inventory/products')
export class InventoryProductsController {
  constructor(private readonly productsService: InventoryProductsService) {}

  @Get()
  @Roles(...INVENTORY_READ_ROLES)
  @ApiOperation({ summary: 'Search inventory products in the active workshop' })
  @ApiOkResponse({ type: InventoryProductPageResponseDto })
  list(
    @CurrentWorkshop() context: WorkshopContext,
    @Query() query: ListInventoryProductsQueryDto,
  ): Promise<InventoryProductPageResponseDto> {
    return this.productsService.list(context, query);
  }

  @Get(':id')
  @Roles(...INVENTORY_READ_ROLES)
  @ApiOperation({ summary: 'Get an inventory product' })
  @ApiOkResponse({ type: InventoryProductResponseDto })
  @ApiNotFoundResponse({ description: 'Inventory product not found.' })
  findOne(
    @CurrentWorkshop() context: WorkshopContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<InventoryProductResponseDto> {
    return this.productsService.findOne(context, id);
  }

  @Post()
  @Roles(...INVENTORY_WRITE_ROLES)
  @ApiOperation({
    summary:
      'Create an inventory product; a positive initialStock is recorded as an INBOUND movement',
  })
  @ApiCreatedResponse({ type: InventoryProductResponseDto })
  @ApiNotFoundResponse({ description: 'Inventory category not found.' })
  @ApiConflictResponse({
    description:
      'The SKU already exists in the workshop or the category is inactive.',
  })
  create(
    @CurrentWorkshop() context: WorkshopContext,
    @Body() dto: CreateInventoryProductDto,
  ): Promise<InventoryProductResponseDto> {
    return this.productsService.create(context, dto);
  }

  @Patch(':id')
  @Roles(...INVENTORY_WRITE_ROLES)
  @ApiOperation({
    summary:
      'Update or deactivate an inventory product (stock changes only through movements)',
  })
  @ApiOkResponse({ type: InventoryProductResponseDto })
  @ApiNotFoundResponse({
    description: 'Inventory product or category not found.',
  })
  @ApiConflictResponse({
    description:
      'The SKU already exists in the workshop or the category is inactive.',
  })
  update(
    @CurrentWorkshop() context: WorkshopContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInventoryProductDto,
  ): Promise<InventoryProductResponseDto> {
    return this.productsService.update(context, id, dto);
  }
}
