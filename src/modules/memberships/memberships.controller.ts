import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import type { WorkshopContext } from '../../common/auth/workshop-context';
import { CurrentWorkshop } from '../../common/decorators/current-workshop.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { WorkshopContextGuard } from '../../common/guards/workshop-context.guard';
import { CreateMembershipDto } from './dto/create-membership.dto';
import { MembershipResponseDto } from './dto/membership-response.dto';
import { ResetMembershipPasswordDto } from './dto/reset-membership-password.dto';
import { UpdateMembershipDto } from './dto/update-membership.dto';
import { MembershipsService } from './memberships.service';

@ApiTags('memberships')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard, WorkshopContextGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('memberships')
export class MembershipsController {
  constructor(private readonly membershipsService: MembershipsService) {}

  @Post()
  @ApiCreatedResponse({ type: MembershipResponseDto })
  @ApiConflictResponse({
    description: 'The email already exists or OWNER was requested.',
  })
  create(
    @CurrentWorkshop() context: WorkshopContext,
    @Body() dto: CreateMembershipDto,
  ): Promise<MembershipResponseDto> {
    return this.membershipsService.create(context, dto);
  }

  @Get()
  @ApiOkResponse({ type: MembershipResponseDto, isArray: true })
  list(
    @CurrentWorkshop() context: WorkshopContext,
  ): Promise<MembershipResponseDto[]> {
    return this.membershipsService.list(context);
  }

  @Get(':id')
  @ApiOkResponse({ type: MembershipResponseDto })
  @ApiNotFoundResponse({ description: 'Membership not found.' })
  findOne(
    @CurrentWorkshop() context: WorkshopContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<MembershipResponseDto> {
    return this.membershipsService.findOne(context, id);
  }

  @Patch(':id')
  @ApiOkResponse({ type: MembershipResponseDto })
  @ApiNotFoundResponse({ description: 'Membership not found.' })
  @ApiConflictResponse({
    description: 'The OWNER membership cannot be changed here.',
  })
  update(
    @CurrentWorkshop() context: WorkshopContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMembershipDto,
  ): Promise<MembershipResponseDto> {
    return this.membershipsService.update(context, id, dto);
  }

  @Post(':id/reset-password')
  @HttpCode(204)
  @ApiNoContentResponse({
    description:
      'A temporary password was stored and all target sessions were revoked.',
  })
  @ApiNotFoundResponse({ description: 'Membership not found.' })
  @ApiConflictResponse({
    description:
      'The password cannot be reset for this membership or identity.',
  })
  resetPassword(
    @CurrentWorkshop() context: WorkshopContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResetMembershipPasswordDto,
  ): Promise<void> {
    return this.membershipsService.resetPassword(
      context,
      id,
      dto.temporaryPassword,
    );
  }
}
