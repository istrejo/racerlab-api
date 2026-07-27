import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import type { WorkshopContext } from '../../common/auth/workshop-context';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentWorkshop } from '../../common/decorators/current-workshop.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { WorkshopContextGuard } from '../../common/guards/workshop-context.guard';
import { LoginResponseDto } from '../auth/dto/login-response.dto';
import { CreateWorkshopDto } from './dto/create-workshop.dto';
import { TransferOwnershipDto } from './dto/transfer-ownership.dto';
import { UpdateWorkshopDto } from './dto/update-workshop.dto';
import { WorkshopResponseDto } from './dto/workshop-response.dto';
import { WorkshopsService } from './workshops.service';

@ApiTags('workshops')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard)
@Controller('workshops')
export class WorkshopsController {
  constructor(private readonly workshopsService: WorkshopsService) {}

  @Get()
  @ApiOkResponse({ type: WorkshopResponseDto, isArray: true })
  list(@CurrentUser() user: AuthenticatedUser): Promise<WorkshopResponseDto[]> {
    return this.workshopsService.list(user.id);
  }

  @Post()
  @ApiCreatedResponse({ type: LoginResponseDto })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateWorkshopDto,
  ): Promise<LoginResponseDto> {
    return this.workshopsService.create(user, dto);
  }

  @Patch('current')
  @UseGuards(WorkshopContextGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOkResponse({ type: WorkshopResponseDto })
  updateCurrent(
    @CurrentWorkshop() context: WorkshopContext,
    @Body() dto: UpdateWorkshopDto,
  ): Promise<WorkshopResponseDto> {
    return this.workshopsService.updateCurrent(context, dto);
  }

  @Post('current/transfer-ownership')
  @UseGuards(WorkshopContextGuard, RolesGuard)
  @Roles(UserRole.OWNER)
  @ApiOkResponse({ type: LoginResponseDto })
  @ApiNotFoundResponse({ description: 'Membership not found.' })
  @ApiConflictResponse({ description: 'Ownership cannot be transferred.' })
  transferOwnership(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentWorkshop() context: WorkshopContext,
    @Body() dto: TransferOwnershipDto,
  ): Promise<LoginResponseDto> {
    return this.workshopsService.transferOwnership(user, context, dto);
  }
}
