import {
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { WorkshopContext } from '../../common/auth/workshop-context';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { LoginResponseDto } from '../auth/dto/login-response.dto';
import { CreateWorkshopDto } from './dto/create-workshop.dto';
import { TransferOwnershipDto } from './dto/transfer-ownership.dto';
import { UpdateWorkshopDto } from './dto/update-workshop.dto';
import { WorkshopResponseDto } from './dto/workshop-response.dto';

const MEMBERSHIP_CONTEXT_INCLUDE = {
  role: { select: { name: true } },
  workshop: { select: { id: true, name: true } },
} satisfies Prisma.MembershipInclude;

@Injectable()
export class WorkshopsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  async list(userId: string): Promise<WorkshopResponseDto[]> {
    const memberships = await this.prisma.membership.findMany({
      where: { userId, isActive: true },
      include: {
        role: { select: { name: true } },
        workshop: {
          select: {
            id: true,
            name: true,
            ownerUserId: true,
          },
        },
      },
      orderBy: [{ workshop: { name: 'asc' } }, { id: 'asc' }],
    });

    return memberships.map((membership) => ({
      id: membership.workshop.id,
      name: membership.workshop.name,
      ownerUserId: membership.workshop.ownerUserId,
      membershipId: membership.id,
      role: membership.role.name,
    }));
  }

  async create(
    user: AuthenticatedUser,
    dto: CreateWorkshopDto,
  ): Promise<LoginResponseDto> {
    const membership = await this.prisma.$transaction(async (tx) => {
      const [ownerRole, owner] = await Promise.all([
        tx.role.findUnique({
          where: { name: UserRole.OWNER },
        }),
        tx.user.findUnique({
          where: { id: user.id },
          select: { name: true, isActive: true },
        }),
      ]);

      if (!ownerRole || !owner?.isActive) {
        throw new ServiceUnavailableException(
          'The OWNER role or user identity is not available.',
        );
      }

      const workshop = await tx.workshop.create({
        data: {
          name: dto.name.trim(),
          ownerUserId: user.id,
        },
      });

      return tx.membership.create({
        data: {
          workshopId: workshop.id,
          userId: user.id,
          roleId: ownerRole.id,
          displayName: owner.name,
          isActive: true,
        },
        include: MEMBERSHIP_CONTEXT_INCLUDE,
      });
    });

    return this.authService.activateMembershipForSession(user, membership);
  }

  async updateCurrent(
    context: WorkshopContext,
    dto: UpdateWorkshopDto,
  ): Promise<WorkshopResponseDto> {
    const workshop = await this.prisma.workshop.update({
      where: { id: context.workshopId },
      data: {
        ...(dto.name ? { name: dto.name.trim() } : {}),
      },
    });

    return {
      id: workshop.id,
      name: workshop.name,
      ownerUserId: workshop.ownerUserId,
      membershipId: context.membershipId,
      role: context.role,
    };
  }

  async transferOwnership(
    user: AuthenticatedUser,
    context: WorkshopContext,
    dto: TransferOwnershipDto,
  ): Promise<LoginResponseDto> {
    if (dto.membershipId === context.membershipId) {
      throw new ConflictException('This membership already owns the workshop.');
    }

    await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "workshops"
        WHERE "id" = ${context.workshopId}::uuid
        FOR UPDATE
      `;

      if (locked.length !== 1) {
        throw new NotFoundException('Workshop not found.');
      }

      const [workshop, target, ownerRole, adminRole] = await Promise.all([
        tx.workshop.findUnique({
          where: { id: context.workshopId },
          select: { ownerUserId: true },
        }),
        tx.membership.findFirst({
          where: {
            id: dto.membershipId,
            workshopId: context.workshopId,
          },
          include: {
            user: { select: { isActive: true } },
          },
        }),
        tx.role.findUnique({ where: { name: UserRole.OWNER } }),
        tx.role.findUnique({ where: { name: UserRole.ADMIN } }),
      ]);

      if (!workshop || !target) {
        throw new NotFoundException('Membership not found.');
      }

      if (!target.user.isActive) {
        throw new ConflictException('The target user is not active.');
      }

      if (!ownerRole || !adminRole) {
        throw new ServiceUnavailableException(
          'Ownership roles are not available.',
        );
      }

      await tx.membership.update({
        where: { id: target.id },
        data: {
          roleId: ownerRole.id,
          isActive: true,
          deactivatedAt: null,
        },
      });

      await tx.workshop.update({
        where: { id: context.workshopId },
        data: { ownerUserId: target.userId },
      });

      const demoted = await tx.membership.updateMany({
        where: {
          workshopId: context.workshopId,
          userId: workshop.ownerUserId,
          roleId: ownerRole.id,
          isActive: true,
        },
        data: { roleId: adminRole.id },
      });

      if (demoted.count !== 1) {
        throw new ConflictException('Workshop ownership is inconsistent.');
      }
    });

    const currentMembership = await this.prisma.membership.findFirst({
      where: {
        id: context.membershipId,
        workshopId: context.workshopId,
        userId: user.id,
        isActive: true,
      },
      include: MEMBERSHIP_CONTEXT_INCLUDE,
    });

    if (!currentMembership) {
      throw new ConflictException('Current membership is no longer active.');
    }

    return this.authService.activateMembershipForSession(
      user,
      currentMembership,
    );
  }
}
