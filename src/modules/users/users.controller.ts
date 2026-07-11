import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CreateUserDto } from './dto/create-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a bootstrap user (temporary unauthenticated endpoint)',
    description:
      'Temporary bootstrap-only endpoint. JWT/Auth/RBAC protection is out of scope for this change and must be added before production exposure.',
  })
  @ApiCreatedResponse({ type: UserResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid create-user payload.' })
  @ApiConflictResponse({
    description: 'A user with this email already exists.',
  })
  @ApiServiceUnavailableResponse({
    description: 'Bootstrap roles are not available.',
  })
  create(@Body() dto: CreateUserDto): Promise<UserResponseDto> {
    return this.usersService.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'List bootstrap users (temporary unauthenticated endpoint)',
    description:
      'Temporary bootstrap-only endpoint. JWT/Auth/RBAC protection is out of scope for this change and must be added before production exposure.',
  })
  @ApiOkResponse({ type: UserResponseDto, isArray: true })
  findAll(): Promise<UserResponseDto[]> {
    return this.usersService.findAll();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a bootstrap user by id (temporary unauthenticated endpoint)',
    description:
      'Temporary bootstrap-only endpoint. JWT/Auth/RBAC protection is out of scope for this change and must be added before production exposure.',
  })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid user id.' })
  @ApiNotFoundResponse({ description: 'User not found.' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<UserResponseDto> {
    return this.usersService.findOne(id);
  }
}
