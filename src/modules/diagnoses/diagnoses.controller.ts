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
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
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
  WORKSHOP_RESOURCE_READ_ROLES,
  WORKSHOP_RESOURCE_WRITE_ROLES,
} from '../../common/auth/workshop-role-policy';
import { CurrentWorkshop } from '../../common/decorators/current-workshop.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { WorkshopContextGuard } from '../../common/guards/workshop-context.guard';
import { DiagnosesService } from './diagnoses.service';
import { CreateDiagnosisDto } from './dto/create-diagnosis.dto';
import { DiagnosisResponseDto } from './dto/diagnosis-response.dto';
import { UpdateDiagnosisDto } from './dto/update-diagnosis.dto';

@ApiTags('diagnoses')
@ApiBearerAuth('bearer')
@ApiBadRequestResponse({ description: 'Request validation failed.' })
@ApiUnauthorizedResponse({ description: 'Authentication is required.' })
@ApiForbiddenResponse({
  description: 'The active workshop role cannot perform this operation.',
})
@UseGuards(JwtAuthGuard, WorkshopContextGuard, RolesGuard)
@Controller('service-orders/:serviceOrderId/diagnoses')
export class DiagnosesController {
  constructor(private readonly diagnosesService: DiagnosesService) {}

  @Get()
  @Roles(...WORKSHOP_RESOURCE_READ_ROLES)
  @ApiOperation({ summary: 'List diagnoses for a service order' })
  @ApiOkResponse({ type: [DiagnosisResponseDto] })
  @ApiNotFoundResponse({ description: 'Service order not found.' })
  list(
    @CurrentWorkshop() context: WorkshopContext,
    @Param('serviceOrderId', ParseUUIDPipe) serviceOrderId: string,
  ): Promise<DiagnosisResponseDto[]> {
    return this.diagnosesService.list(context, serviceOrderId);
  }

  @Get(':id')
  @Roles(...WORKSHOP_RESOURCE_READ_ROLES)
  @ApiOperation({ summary: 'Get a single diagnosis' })
  @ApiOkResponse({ type: DiagnosisResponseDto })
  @ApiNotFoundResponse({ description: 'Diagnosis not found.' })
  findOne(
    @CurrentWorkshop() context: WorkshopContext,
    @Param('serviceOrderId', ParseUUIDPipe) serviceOrderId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<DiagnosisResponseDto> {
    return this.diagnosesService.findOne(context, serviceOrderId, id);
  }

  @Post()
  @Roles(...WORKSHOP_RESOURCE_READ_ROLES)
  @ApiOperation({ summary: 'Add a diagnosis to a service order' })
  @ApiCreatedResponse({ type: DiagnosisResponseDto })
  @ApiNotFoundResponse({ description: 'Service order not found.' })
  create(
    @CurrentWorkshop() context: WorkshopContext,
    @Param('serviceOrderId', ParseUUIDPipe) serviceOrderId: string,
    @Body() dto: CreateDiagnosisDto,
  ): Promise<DiagnosisResponseDto> {
    return this.diagnosesService.create(context, serviceOrderId, dto);
  }

  @Patch(':id')
  @Roles(...WORKSHOP_RESOURCE_READ_ROLES)
  @ApiOperation({ summary: 'Update a diagnosis' })
  @ApiOkResponse({ type: DiagnosisResponseDto })
  @ApiNotFoundResponse({ description: 'Diagnosis not found.' })
  update(
    @CurrentWorkshop() context: WorkshopContext,
    @Param('serviceOrderId', ParseUUIDPipe) serviceOrderId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDiagnosisDto,
  ): Promise<DiagnosisResponseDto> {
    return this.diagnosesService.update(context, serviceOrderId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles(...WORKSHOP_RESOURCE_WRITE_ROLES)
  @ApiOperation({ summary: 'Delete a diagnosis' })
  @ApiNoContentResponse({ description: 'Diagnosis deleted.' })
  @ApiNotFoundResponse({ description: 'Diagnosis not found.' })
  remove(
    @CurrentWorkshop() context: WorkshopContext,
    @Param('serviceOrderId', ParseUUIDPipe) serviceOrderId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.diagnosesService.remove(context, serviceOrderId, id);
  }
}
