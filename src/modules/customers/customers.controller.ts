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
import { UserRole } from '@prisma/client';
import type { WorkshopContext } from '../../common/auth/workshop-context';
import { CurrentWorkshop } from '../../common/decorators/current-workshop.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { WorkshopContextGuard } from '../../common/guards/workshop-context.guard';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { CustomerPageResponseDto } from './dto/customer-page-response.dto';
import { CustomerResponseDto } from './dto/customer-response.dto';
import { ListCustomersQueryDto } from './dto/list-customers-query.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

const CUSTOMER_READ_ROLES = [
  UserRole.ADMIN,
  UserRole.MANAGER,
  UserRole.ADVISOR,
  UserRole.TECHNICIAN,
] as const;

const CUSTOMER_WRITE_ROLES = [
  UserRole.ADMIN,
  UserRole.MANAGER,
  UserRole.ADVISOR,
] as const;

@ApiTags('customers')
@ApiBearerAuth('bearer')
@ApiBadRequestResponse({ description: 'Request validation failed.' })
@ApiUnauthorizedResponse({ description: 'Authentication is required.' })
@ApiForbiddenResponse({
  description: 'The active workshop role cannot perform this operation.',
})
@UseGuards(JwtAuthGuard, WorkshopContextGuard, RolesGuard)
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  @Roles(...CUSTOMER_READ_ROLES)
  @ApiOperation({ summary: 'Search customers in the active workshop' })
  @ApiOkResponse({ type: CustomerPageResponseDto })
  list(
    @CurrentWorkshop() context: WorkshopContext,
    @Query() query: ListCustomersQueryDto,
  ): Promise<CustomerPageResponseDto> {
    return this.customersService.list(context, query);
  }

  @Get(':id')
  @Roles(...CUSTOMER_READ_ROLES)
  @ApiOperation({ summary: 'Get a customer from the active workshop' })
  @ApiOkResponse({ type: CustomerResponseDto })
  @ApiNotFoundResponse({ description: 'Customer not found.' })
  findOne(
    @CurrentWorkshop() context: WorkshopContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CustomerResponseDto> {
    return this.customersService.findOne(context, id);
  }

  @Post()
  @Roles(...CUSTOMER_WRITE_ROLES)
  @ApiOperation({ summary: 'Create a customer in the active workshop' })
  @ApiCreatedResponse({ type: CustomerResponseDto })
  @ApiConflictResponse({
    description: 'The normalized document already exists.',
  })
  create(
    @CurrentWorkshop() context: WorkshopContext,
    @Body() dto: CreateCustomerDto,
  ): Promise<CustomerResponseDto> {
    return this.customersService.create(context, dto);
  }

  @Patch(':id')
  @Roles(...CUSTOMER_WRITE_ROLES)
  @ApiOperation({ summary: 'Update a customer in the active workshop' })
  @ApiOkResponse({ type: CustomerResponseDto })
  @ApiNotFoundResponse({ description: 'Customer not found.' })
  @ApiConflictResponse({
    description: 'The normalized document already exists.',
  })
  update(
    @CurrentWorkshop() context: WorkshopContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomerDto,
  ): Promise<CustomerResponseDto> {
    return this.customersService.update(context, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete an unreferenced customer' })
  @ApiNoContentResponse({ description: 'Customer deleted.' })
  @ApiNotFoundResponse({ description: 'Customer not found.' })
  @ApiConflictResponse({
    description: 'Customers with vehicles or service orders cannot be deleted.',
  })
  remove(
    @CurrentWorkshop() context: WorkshopContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.customersService.remove(context, id);
  }
}
