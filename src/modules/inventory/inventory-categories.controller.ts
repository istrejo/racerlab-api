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
import { CreateInventoryCategoryDto } from './dto/create-inventory-category.dto';
import { InventoryCategoryPageResponseDto } from './dto/inventory-category-page-response.dto';
import { InventoryCategoryResponseDto } from './dto/inventory-category-response.dto';
import { ListInventoryCategoriesQueryDto } from './dto/list-inventory-categories-query.dto';
import { UpdateInventoryCategoryDto } from './dto/update-inventory-category.dto';
import { InventoryCategoriesService } from './inventory-categories.service';

@ApiTags('inventory')
@ApiBearerAuth('bearer')
@ApiBadRequestResponse({ description: 'Request validation failed.' })
@ApiUnauthorizedResponse({ description: 'Authentication is required.' })
@ApiForbiddenResponse({
  description: 'The active workshop role cannot perform this operation.',
})
@UseGuards(JwtAuthGuard, WorkshopContextGuard, RolesGuard)
@Controller('inventory/categories')
export class InventoryCategoriesController {
  constructor(private readonly categoriesService: InventoryCategoriesService) {}

  @Get()
  @Roles(...INVENTORY_READ_ROLES)
  @ApiOperation({ summary: 'List inventory categories in the active workshop' })
  @ApiOkResponse({ type: InventoryCategoryPageResponseDto })
  list(
    @CurrentWorkshop() context: WorkshopContext,
    @Query() query: ListInventoryCategoriesQueryDto,
  ): Promise<InventoryCategoryPageResponseDto> {
    return this.categoriesService.list(context, query);
  }

  @Post()
  @Roles(...INVENTORY_WRITE_ROLES)
  @ApiOperation({ summary: 'Create an inventory category' })
  @ApiCreatedResponse({ type: InventoryCategoryResponseDto })
  @ApiConflictResponse({
    description: 'A category with this name already exists in the workshop.',
  })
  create(
    @CurrentWorkshop() context: WorkshopContext,
    @Body() dto: CreateInventoryCategoryDto,
  ): Promise<InventoryCategoryResponseDto> {
    return this.categoriesService.create(context, dto);
  }

  @Patch(':id')
  @Roles(...INVENTORY_WRITE_ROLES)
  @ApiOperation({
    summary: 'Update or deactivate an inventory category (no hard delete)',
  })
  @ApiOkResponse({ type: InventoryCategoryResponseDto })
  @ApiNotFoundResponse({ description: 'Inventory category not found.' })
  @ApiConflictResponse({
    description: 'A category with this name already exists in the workshop.',
  })
  update(
    @CurrentWorkshop() context: WorkshopContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInventoryCategoryDto,
  ): Promise<InventoryCategoryResponseDto> {
    return this.categoriesService.update(context, id, dto);
  }
}
