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
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
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
import { AssignTechnicianDto } from './dto/assign-technician.dto';
import { ChangeStatusDto } from './dto/change-status.dto';
import { CreateServiceOrderDto } from './dto/create-service-order.dto';
import { ListServiceOrdersQueryDto } from './dto/list-service-orders-query.dto';
import { ServiceOrderDetailResponseDto } from './dto/service-order-detail-response.dto';
import { ServiceOrderPageResponseDto } from './dto/service-order-page-response.dto';
import { UpdateServiceOrderDto } from './dto/update-service-order.dto';
import { ServiceOrdersService } from './service-orders.service';

const ORDER_READ_ROLES = [
  UserRole.ADMIN,
  UserRole.MANAGER,
  UserRole.ADVISOR,
  UserRole.TECHNICIAN,
] as const;

const ORDER_WRITE_ROLES = [UserRole.ADMIN, UserRole.MANAGER, UserRole.ADVISOR] as const;

const ORDER_STATUS_ROLES = [
  UserRole.ADMIN,
  UserRole.MANAGER,
  UserRole.ADVISOR,
  UserRole.TECHNICIAN,
] as const;

@ApiTags('service-orders')
@ApiBearerAuth('bearer')
@ApiBadRequestResponse({ description: 'Request validation failed.' })
@ApiUnauthorizedResponse({ description: 'Authentication is required.' })
@ApiForbiddenResponse({
  description: 'The active workshop role cannot perform this operation.',
})
@UseGuards(JwtAuthGuard, WorkshopContextGuard, RolesGuard)
@Controller('service-orders')
export class ServiceOrdersController {
  constructor(private readonly serviceOrdersService: ServiceOrdersService) {}

  @Get()
  @Roles(...ORDER_READ_ROLES)
  @ApiOperation({ summary: 'List service orders in the active workshop' })
  @ApiOkResponse({ type: ServiceOrderPageResponseDto })
  list(
    @CurrentWorkshop() context: WorkshopContext,
    @Query() query: ListServiceOrdersQueryDto,
  ): Promise<ServiceOrderPageResponseDto> {
    return this.serviceOrdersService.list(context, query);
  }

  @Get(':id')
  @Roles(...ORDER_READ_ROLES)
  @ApiOperation({ summary: 'Get a service order from the active workshop' })
  @ApiOkResponse({ type: ServiceOrderDetailResponseDto })
  @ApiNotFoundResponse({ description: 'Service order not found.' })
  findOne(
    @CurrentWorkshop() context: WorkshopContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ServiceOrderDetailResponseDto> {
    return this.serviceOrdersService.findOne(context, id);
  }

  @Post()
  @Roles(...ORDER_WRITE_ROLES)
  @ApiOperation({ summary: 'Create a service order in the active workshop' })
  @ApiCreatedResponse({ type: ServiceOrderDetailResponseDto })
  @ApiNotFoundResponse({ description: 'Customer or vehicle not found.' })
  create(
    @CurrentWorkshop() context: WorkshopContext,
    @Body() dto: CreateServiceOrderDto,
  ): Promise<ServiceOrderDetailResponseDto> {
    return this.serviceOrdersService.create(context, dto);
  }

  @Patch(':id')
  @Roles(...ORDER_WRITE_ROLES)
  @ApiOperation({ summary: 'Update editable fields of a service order' })
  @ApiOkResponse({ type: ServiceOrderDetailResponseDto })
  @ApiNotFoundResponse({ description: 'Service order not found.' })
  update(
    @CurrentWorkshop() context: WorkshopContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateServiceOrderDto,
  ): Promise<ServiceOrderDetailResponseDto> {
    return this.serviceOrdersService.update(context, id, dto);
  }

  @Patch(':id/status')
  @Roles(...ORDER_STATUS_ROLES)
  @ApiOperation({ summary: 'Transition service order to a new status' })
  @ApiOkResponse({ type: ServiceOrderDetailResponseDto })
  @ApiNotFoundResponse({ description: 'Service order not found.' })
  @ApiBadRequestResponse({ description: 'Status transition not allowed.' })
  changeStatus(
    @CurrentWorkshop() context: WorkshopContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeStatusDto,
  ): Promise<ServiceOrderDetailResponseDto> {
    return this.serviceOrdersService.changeStatus(context, id, dto);
  }

  @Patch(':id/technician')
  @Roles(...ORDER_WRITE_ROLES)
  @ApiOperation({ summary: 'Assign or unassign a technician to a service order' })
  @ApiOkResponse({ type: ServiceOrderDetailResponseDto })
  @ApiNotFoundResponse({ description: 'Service order or technician not found.' })
  assignTechnician(
    @CurrentWorkshop() context: WorkshopContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignTechnicianDto,
  ): Promise<ServiceOrderDetailResponseDto> {
    return this.serviceOrdersService.assignTechnician(context, id, dto);
  }
}
