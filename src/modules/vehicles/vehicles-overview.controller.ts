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
import type { WorkshopContext } from '../../common/auth/workshop-context';
import { WORKSHOP_RESOURCE_READ_ROLES } from '../../common/auth/workshop-role-policy';
import { CurrentWorkshop } from '../../common/decorators/current-workshop.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { WorkshopContextGuard } from '../../common/guards/workshop-context.guard';
import { ListVehiclesQueryDto } from './dto/list-vehicles-query.dto';
import { VehicleWithCustomerPageResponseDto } from './dto/vehicle-with-customer-page-response.dto';
import { VehiclesService } from './vehicles.service';

@ApiTags('vehicles')
@ApiBearerAuth('bearer')
@ApiBadRequestResponse({ description: 'Request validation failed.' })
@ApiUnauthorizedResponse({ description: 'Authentication is required.' })
@ApiForbiddenResponse({
  description: 'The active workshop role cannot perform this operation.',
})
@UseGuards(JwtAuthGuard, WorkshopContextGuard, RolesGuard)
@Controller('vehicles')
export class VehiclesOverviewController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Get()
  @Roles(...WORKSHOP_RESOURCE_READ_ROLES)
  @ApiOperation({ summary: 'List vehicles across the active workshop' })
  @ApiOkResponse({ type: VehicleWithCustomerPageResponseDto })
  list(
    @CurrentWorkshop() context: WorkshopContext,
    @Query() query: ListVehiclesQueryDto,
  ): Promise<VehicleWithCustomerPageResponseDto> {
    return this.vehiclesService.listForWorkshop(context, query);
  }
}
