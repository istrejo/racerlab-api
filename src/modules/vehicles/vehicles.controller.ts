import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
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
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { WorkshopContext } from '../../common/auth/workshop-context';
import {
  WORKSHOP_RESOURCE_DELETE_ROLES,
  WORKSHOP_RESOURCE_READ_ROLES,
  WORKSHOP_RESOURCE_WRITE_ROLES,
} from '../../common/auth/workshop-role-policy';
import { CurrentWorkshop } from '../../common/decorators/current-workshop.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { WorkshopContextGuard } from '../../common/guards/workshop-context.guard';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { ListVehiclesQueryDto } from './dto/list-vehicles-query.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { VehiclePageResponseDto } from './dto/vehicle-page-response.dto';
import { VehicleResponseDto } from './dto/vehicle-response.dto';
import { VehiclesService } from './vehicles.service';

@ApiTags('vehicles')
@ApiBearerAuth('bearer')
@ApiBadRequestResponse({ description: 'Request validation failed.' })
@ApiUnauthorizedResponse({ description: 'Authentication is required.' })
@ApiForbiddenResponse({
  description: 'The active workshop role cannot perform this operation.',
})
@UseGuards(JwtAuthGuard, WorkshopContextGuard, RolesGuard)
@Controller('customers/:customerId/vehicles')
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Get()
  @Roles(...WORKSHOP_RESOURCE_READ_ROLES)
  @ApiOperation({
    summary: 'List vehicles for a customer in the active workshop',
  })
  @ApiOkResponse({ type: VehiclePageResponseDto })
  @ApiNotFoundResponse({ description: 'Customer not found.' })
  list(
    @CurrentWorkshop() context: WorkshopContext,
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Query() query: ListVehiclesQueryDto,
  ): Promise<VehiclePageResponseDto> {
    return this.vehiclesService.list(context, customerId, query);
  }

  @Get(':id')
  @Roles(...WORKSHOP_RESOURCE_READ_ROLES)
  @ApiOperation({ summary: 'Get a vehicle from the active workshop' })
  @ApiOkResponse({ type: VehicleResponseDto })
  @ApiNotFoundResponse({ description: 'Vehicle not found.' })
  findOne(
    @CurrentWorkshop() context: WorkshopContext,
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<VehicleResponseDto> {
    return this.vehiclesService.findOne(context, customerId, id);
  }

  @Post()
  @Roles(...WORKSHOP_RESOURCE_WRITE_ROLES)
  @ApiOperation({
    summary: 'Create a vehicle for a customer in the active workshop',
  })
  @ApiCreatedResponse({ type: VehicleResponseDto })
  @ApiNotFoundResponse({ description: 'Customer not found.' })
  @ApiConflictResponse({
    description: 'A vehicle with this plate already exists in the workshop.',
  })
  create(
    @CurrentWorkshop() context: WorkshopContext,
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Body() dto: CreateVehicleDto,
  ): Promise<VehicleResponseDto> {
    return this.vehiclesService.create(context, customerId, dto);
  }

  @Patch(':id')
  @Roles(...WORKSHOP_RESOURCE_WRITE_ROLES)
  @ApiOperation({ summary: 'Update a vehicle in the active workshop' })
  @ApiOkResponse({ type: VehicleResponseDto })
  @ApiNotFoundResponse({ description: 'Vehicle not found.' })
  @ApiConflictResponse({
    description: 'A vehicle with this plate already exists in the workshop.',
  })
  update(
    @CurrentWorkshop() context: WorkshopContext,
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVehicleDto,
  ): Promise<VehicleResponseDto> {
    return this.vehiclesService.update(context, customerId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles(...WORKSHOP_RESOURCE_DELETE_ROLES)
  @ApiOperation({ summary: 'Delete an unreferenced vehicle' })
  @ApiNoContentResponse({ description: 'Vehicle deleted.' })
  @ApiNotFoundResponse({ description: 'Vehicle not found.' })
  @ApiConflictResponse({
    description: 'Vehicles with service orders cannot be deleted.',
  })
  remove(
    @CurrentWorkshop() context: WorkshopContext,
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.vehiclesService.remove(context, customerId, id);
  }
}
