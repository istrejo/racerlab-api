import {
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Role, User } from '@prisma/client';
import { PasswordHasherService } from '../../common/security/password-hasher.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';

type UserWithRole = User & { role: Pick<Role, 'name'> };

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordHasher: PasswordHasherService,
  ) {}

  async create(dto: CreateUserDto): Promise<UserResponseDto> {
    const role = await this.prisma.role.findUnique({
      where: { name: dto.role },
    });

    if (!role) {
      throw new ServiceUnavailableException(
        'Bootstrap roles are not available. Run the Prisma seed before creating users.',
      );
    }

    const passwordHash = await this.passwordHasher.hash(dto.password);

    try {
      const user = await this.prisma.user.create({
        data: {
          name: dto.name,
          email: dto.email,
          passwordHash,
          roleId: role.id,
          isActive: dto.isActive ?? true,
        },
        include: { role: true },
      });

      return this.mapUserToResponse(user);
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException('A user with this email already exists.');
      }

      throw error;
    }
  }

  async findAll(): Promise<UserResponseDto[]> {
    const users = await this.prisma.user.findMany({
      include: { role: true },
      orderBy: { createdAt: 'desc' },
    });

    return users.map((user) => this.mapUserToResponse(user));
  }

  async findOne(id: string): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { role: true },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    return this.mapUserToResponse(user);
  }

  async update(id: string, dto: UpdateUserDto): Promise<UserResponseDto> {
    const data: {
      name?: string;
      email?: string;
      roleId?: string;
      isActive?: boolean;
    } = {
      name: dto.name,
      email: dto.email,
      isActive: dto.isActive,
    };

    if (dto.role) {
      const role = await this.prisma.role.findUnique({
        where: { name: dto.role },
      });

      if (!role) {
        throw new ServiceUnavailableException(
          'Bootstrap roles are not available. Run the Prisma seed before updating users.',
        );
      }

      data.roleId = role.id;
    }

    try {
      const user = await this.prisma.user.update({
        where: { id },
        data,
        include: { role: true },
      });

      return this.mapUserToResponse(user);
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException('A user with this email already exists.');
      }

      if (this.isRecordNotFoundError(error)) {
        throw new NotFoundException('User not found.');
      }

      throw error;
    }
  }

  private mapUserToResponse(user: UserWithRole): UserResponseDto {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role.name,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    );
  }

  private isRecordNotFoundError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2025'
    );
  }
}
