import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Membership, Prisma, Role, User, UserRole } from '@prisma/client';
import { WorkshopContext } from '../../common/auth/workshop-context';
import { PasswordHasherService } from '../../common/security/password-hasher.service';
import { normalizeEmail } from '../../common/utils/email-normalizer';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateMembershipDto } from './dto/create-membership.dto';
import { MembershipResponseDto } from './dto/membership-response.dto';
import { UpdateMembershipDto } from './dto/update-membership.dto';

type MembershipWithUserAndRole = Membership & {
  user: Pick<User, 'id' | 'name' | 'email' | 'isActive' | 'mustChangePassword'>;
  role: Pick<Role, 'name'>;
};

const MEMBERSHIP_INCLUDE = {
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      isActive: true,
      mustChangePassword: true,
    },
  },
  role: { select: { name: true } },
} as const;

@Injectable()
export class MembershipsService {
  private readonly logger = new Logger(MembershipsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordHasher: PasswordHasherService,
  ) {}

  async create(
    context: WorkshopContext,
    dto: CreateMembershipDto,
  ): Promise<MembershipResponseDto> {
    if (dto.role === UserRole.OWNER) {
      throw new ConflictException(
        'OWNER can only be assigned through ownership transfer.',
      );
    }

    const email = normalizeEmail(dto.email);
    const passwordHash = await this.passwordHasher.hash(dto.password);

    try {
      const membership = await this.prisma.$transaction(async (tx) => {
        await this.lockWorkshop(tx, context.workshopId);

        const [existingUser, role] = await Promise.all([
          tx.user.findFirst({
            where: {
              email: {
                equals: email,
                mode: 'insensitive',
              },
            },
            select: { id: true },
          }),
          tx.role.findUnique({ where: { name: dto.role } }),
        ]);

        if (existingUser) {
          throw new ConflictException('Email is already registered.');
        }

        if (!role || role.name === UserRole.OWNER) {
          throw new ServiceUnavailableException(
            'The requested role is not available.',
          );
        }

        const user = await tx.user.create({
          data: {
            name: dto.name,
            email,
            passwordHash,
            isActive: true,
            mustChangePassword: true,
          },
        });

        return tx.membership.create({
          data: {
            workshopId: context.workshopId,
            userId: user.id,
            roleId: role.id,
            displayName: dto.name,
            phone: this.normalizeNullable(dto.phone),
            address: this.normalizeNullable(dto.address),
            isActive: true,
          },
          include: MEMBERSHIP_INCLUDE,
        });
      });

      this.logger.log(
        `Membership ${membership.id} created in workshop ${context.workshopId} by membership ${context.membershipId}.`,
      );
      return this.toResponse(membership);
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException('Email is already registered.');
      }
      throw error;
    }
  }

  async list(context: WorkshopContext): Promise<MembershipResponseDto[]> {
    const memberships = await this.prisma.membership.findMany({
      where: { workshopId: context.workshopId },
      include: MEMBERSHIP_INCLUDE,
      orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }, { id: 'asc' }],
    });

    return memberships.map((membership) => this.toResponse(membership));
  }

  async findOne(
    context: WorkshopContext,
    membershipId: string,
  ): Promise<MembershipResponseDto> {
    const membership = await this.findScoped(context, membershipId);

    if (!membership) {
      throw new NotFoundException('Membership not found.');
    }

    return this.toResponse(membership);
  }

  async update(
    context: WorkshopContext,
    membershipId: string,
    dto: UpdateMembershipDto,
  ): Promise<MembershipResponseDto> {
    const membership = await this.prisma.$transaction(async (tx) => {
      await this.lockWorkshop(tx, context.workshopId);

      const existing = await tx.membership.findFirst({
        where: {
          id: membershipId,
          workshopId: context.workshopId,
        },
        include: MEMBERSHIP_INCLUDE,
      });

      if (!existing) {
        throw new NotFoundException('Membership not found.');
      }

      if (existing.role.name === UserRole.OWNER) {
        throw new ConflictException(
          'The OWNER membership can only change through ownership transfer.',
        );
      }

      if (
        existing.id === context.membershipId &&
        (dto.role !== undefined || dto.isActive !== undefined)
      ) {
        throw new ConflictException(
          'You cannot change your own role or activation state.',
        );
      }

      if (dto.isActive === true && !existing.user.isActive) {
        throw new ConflictException('The global user is not active.');
      }

      let roleId: string | undefined;

      if (dto.role) {
        if (dto.role === UserRole.OWNER) {
          throw new ConflictException(
            'OWNER can only be assigned through ownership transfer.',
          );
        }

        const role = await tx.role.findUnique({
          where: { name: dto.role },
        });

        if (!role) {
          throw new ServiceUnavailableException(
            'The requested role is missing.',
          );
        }

        roleId = role.id;
      }

      return tx.membership.update({
        where: { id: existing.id },
        data: {
          ...(dto.name === undefined ? {} : { displayName: dto.name }),
          ...(dto.phone === undefined
            ? {}
            : { phone: this.normalizeNullable(dto.phone) }),
          ...(dto.address === undefined
            ? {}
            : { address: this.normalizeNullable(dto.address) }),
          ...(roleId ? { roleId } : {}),
          ...(dto.isActive === undefined
            ? {}
            : {
                isActive: dto.isActive,
                deactivatedAt: dto.isActive ? null : new Date(),
              }),
        },
        include: MEMBERSHIP_INCLUDE,
      });
    });

    this.logger.log(
      `Membership ${membership.id} updated in workshop ${context.workshopId} by membership ${context.membershipId}.`,
    );
    return this.toResponse(membership);
  }

  async resetPassword(
    context: WorkshopContext,
    membershipId: string,
    temporaryPassword: string,
  ): Promise<void> {
    const passwordHash = await this.passwordHasher.hash(temporaryPassword);
    const revokedAt = new Date();

    const targetUserId = await this.prisma.$transaction(async (tx) => {
      await this.lockWorkshop(tx, context.workshopId);

      const target = await tx.membership.findFirst({
        where: {
          id: membershipId,
          workshopId: context.workshopId,
        },
        include: {
          role: { select: { name: true } },
          user: {
            select: {
              id: true,
              _count: { select: { memberships: true } },
            },
          },
        },
      });

      if (!target) {
        throw new NotFoundException('Membership not found.');
      }

      if (target.role.name === UserRole.OWNER) {
        throw new ConflictException(
          'The OWNER password cannot be reset from membership management.',
        );
      }

      if (target.id === context.membershipId) {
        throw new ConflictException(
          'Use the authenticated password change flow for your own account.',
        );
      }

      if (target.user._count.memberships !== 1) {
        throw new ConflictException(
          'A multi-workshop identity cannot be reset from one workshop.',
        );
      }

      await tx.user.update({
        where: { id: target.user.id },
        data: {
          passwordHash,
          mustChangePassword: true,
        },
      });

      await tx.authSession.updateMany({
        where: {
          userId: target.user.id,
          revokedAt: null,
        },
        data: { revokedAt },
      });

      return target.user.id;
    });

    this.logger.log(
      `Temporary password set for user ${targetUserId} by membership ${context.membershipId}; active sessions revoked.`,
    );
  }

  private async lockWorkshop(
    tx: Prisma.TransactionClient,
    workshopId: string,
  ): Promise<void> {
    const workshops = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "workshops"
      WHERE "id" = ${workshopId}::uuid
      FOR UPDATE
    `;

    if (workshops.length !== 1) {
      throw new NotFoundException('Workshop not found.');
    }
  }

  private findScoped(context: WorkshopContext, membershipId: string) {
    return this.prisma.membership.findFirst({
      where: {
        id: membershipId,
        workshopId: context.workshopId,
      },
      include: MEMBERSHIP_INCLUDE,
    });
  }

  private normalizeNullable(value: string | null | undefined): string | null {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }

  private toResponse(
    membership: MembershipWithUserAndRole,
  ): MembershipResponseDto {
    return {
      id: membership.id,
      workshopId: membership.workshopId,
      role: membership.role.name,
      name: membership.displayName,
      phone: membership.phone,
      address: membership.address,
      isActive: membership.isActive,
      user: membership.user,
      createdAt: membership.createdAt,
      updatedAt: membership.updatedAt,
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
}
