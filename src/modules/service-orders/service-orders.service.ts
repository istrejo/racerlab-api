import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ServiceOrderStatus, UserRole } from '@prisma/client';
import type { WorkshopContext } from '../../common/auth/workshop-context';
import { PrismaService } from '../../prisma/prisma.service';
import { AssignTechnicianDto } from './dto/assign-technician.dto';
import { ChangeStatusDto } from './dto/change-status.dto';
import { CreateServiceOrderDto } from './dto/create-service-order.dto';
import { ListServiceOrdersQueryDto } from './dto/list-service-orders-query.dto';
import { ServiceOrderDetailResponseDto } from './dto/service-order-detail-response.dto';
import { ServiceOrderPageResponseDto } from './dto/service-order-page-response.dto';
import { ServiceOrderResponseDto } from './dto/service-order-response.dto';
import { UpdateServiceOrderDto } from './dto/update-service-order.dto';

const ALLOWED_TRANSITIONS: Record<ServiceOrderStatus, ServiceOrderStatus[]> = {
  [ServiceOrderStatus.RECEIVED]: [
    ServiceOrderStatus.DIAGNOSIS,
    ServiceOrderStatus.CANCELLED,
  ],
  [ServiceOrderStatus.DIAGNOSIS]: [
    ServiceOrderStatus.QUOTED,
    ServiceOrderStatus.CANCELLED,
  ],
  [ServiceOrderStatus.QUOTED]: [
    ServiceOrderStatus.APPROVED,
    ServiceOrderStatus.CANCELLED,
  ],
  [ServiceOrderStatus.APPROVED]: [
    ServiceOrderStatus.IN_PROGRESS,
    ServiceOrderStatus.CANCELLED,
  ],
  [ServiceOrderStatus.IN_PROGRESS]: [
    ServiceOrderStatus.QUALITY_CONTROL,
    ServiceOrderStatus.CANCELLED,
  ],
  [ServiceOrderStatus.QUALITY_CONTROL]: [
    ServiceOrderStatus.READY_FOR_DELIVERY,
    ServiceOrderStatus.IN_PROGRESS,
  ],
  [ServiceOrderStatus.READY_FOR_DELIVERY]: [ServiceOrderStatus.DELIVERED],
  [ServiceOrderStatus.DELIVERED]: [],
  [ServiceOrderStatus.CANCELLED]: [],
};

const ORDER_INCLUDE = {
  customer: { select: { id: true, fullName: true } },
  vehicle: { select: { id: true, plate: true, brand: true, model: true } },
  assignedTechnician: { select: { userId: true, displayName: true } },
  _count: { select: { diagnoses: true } },
} as const;

const ORDER_DETAIL_INCLUDE = {
  customer: { select: { id: true, fullName: true } },
  vehicle: { select: { id: true, plate: true, brand: true, model: true } },
  assignedTechnician: { select: { userId: true, displayName: true } },
  createdBy: { select: { userId: true, displayName: true } },
  _count: { select: { diagnoses: true } },
  statusHistory: {
    orderBy: { createdAt: 'asc' as const },
    select: {
      id: true,
      previousStatus: true,
      newStatus: true,
      comment: true,
      createdAt: true,
      changedBy: { select: { userId: true, displayName: true } },
    },
  },
} as const;

type OrderWithRelations = any;
type OrderDetailWithRelations = any;

@Injectable()
export class ServiceOrdersService {
  private readonly logger = new Logger(ServiceOrdersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(
    context: WorkshopContext,
    dto: CreateServiceOrderDto,
  ): Promise<ServiceOrderDetailResponseDto> {
    const order = await this.prisma.$transaction(async (tx) => {
      const creatorUserId = await this.resolveUserId(tx, context);

      await this.assertCustomerExists(tx, context, dto.customerId);
      await this.assertVehicleBelongsToCustomer(
        tx,
        context,
        dto.vehicleId,
        dto.customerId,
      );

      let assignedTechnicianId: string | null = null;
      if (dto.technicianId) {
        assignedTechnicianId = await this.resolveTechnicianUserId(
          tx,
          context,
          dto.technicianId,
        );
      }

      const code = await this.generateCode(tx, context.workshopId);

      const created = await tx.serviceOrder.create({
        data: {
          workshopId: context.workshopId,
          code,
          customerId: dto.customerId,
          vehicleId: dto.vehicleId,
          createdById: creatorUserId,
          assignedTechnicianId,
          priority: dto.priority ?? null,
          reportedIssues: dto.reportedIssues ?? null,
          receptionNotes: dto.receptionNotes ?? null,
          mileageIn: dto.mileageIn ?? null,
          fuelLevel: dto.fuelLevel ?? null,
          estimatedDeliveryDate: dto.estimatedDeliveryDate
            ? new Date(dto.estimatedDeliveryDate)
            : null,
          statusHistory: {
            create: {
              previousStatus: null,
              newStatus: ServiceOrderStatus.RECEIVED,
              changedById: creatorUserId,
            },
          },
        },
        include: ORDER_DETAIL_INCLUDE,
      });

      return created;
    });

    this.logger.log(
      `Service order ${order.code} (${order.id}) created in workshop ${context.workshopId} by membership ${context.membershipId}.`,
    );
    return this.toDetailResponse(order);
  }

  async list(
    context: WorkshopContext,
    query: ListServiceOrdersQueryDto,
  ): Promise<ServiceOrderPageResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const search = query.search?.trim();

    const where: Prisma.ServiceOrderWhereInput = {
      workshopId: context.workshopId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.vehicleId ? { vehicleId: query.vehicleId } : {}),
      ...(search
        ? {
            OR: [
              { code: { contains: search, mode: 'insensitive' } },
              {
                customer: {
                  fullName: { contains: search, mode: 'insensitive' },
                },
              },
              { vehicle: { plate: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [orders, total] = await this.prisma.$transaction([
      this.prisma.serviceOrder.findMany({
        where,
        include: ORDER_INCLUDE,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.serviceOrder.count({ where }),
    ]);

    return {
      items: orders.map((o) => this.toResponse(o)),
      page,
      limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    };
  }

  async findOne(
    context: WorkshopContext,
    serviceOrderId: string,
  ): Promise<ServiceOrderDetailResponseDto> {
    const order = await this.prisma.serviceOrder.findFirst({
      where: { id: serviceOrderId, workshopId: context.workshopId },
      include: ORDER_DETAIL_INCLUDE,
    });

    if (!order) {
      throw new NotFoundException('Service order not found.');
    }

    return this.toDetailResponse(order);
  }

  async update(
    context: WorkshopContext,
    serviceOrderId: string,
    dto: UpdateServiceOrderDto,
  ): Promise<ServiceOrderDetailResponseDto> {
    const order = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.serviceOrder.findFirst({
        where: { id: serviceOrderId, workshopId: context.workshopId },
        select: { id: true, status: true },
      });

      if (!existing) {
        throw new NotFoundException('Service order not found.');
      }

      if (
        existing.status === ServiceOrderStatus.DELIVERED &&
        context.role !== UserRole.ADMIN &&
        context.role !== UserRole.OWNER
      ) {
        throw new ForbiddenException('Delivered orders cannot be modified.');
      }

      return tx.serviceOrder.update({
        where: { id: existing.id },
        data: {
          ...(dto.priority !== undefined
            ? { priority: dto.priority ?? null }
            : {}),
          ...(dto.reportedIssues !== undefined
            ? { reportedIssues: dto.reportedIssues ?? null }
            : {}),
          ...(dto.receptionNotes !== undefined
            ? { receptionNotes: dto.receptionNotes ?? null }
            : {}),
          ...(dto.mileageIn !== undefined
            ? { mileageIn: dto.mileageIn ?? null }
            : {}),
          ...(dto.fuelLevel !== undefined
            ? { fuelLevel: dto.fuelLevel ?? null }
            : {}),
          ...(dto.estimatedDeliveryDate !== undefined
            ? {
                estimatedDeliveryDate: dto.estimatedDeliveryDate
                  ? new Date(dto.estimatedDeliveryDate)
                  : null,
              }
            : {}),
        },
        include: ORDER_DETAIL_INCLUDE,
      });
    });

    this.logger.log(
      `Service order ${order.id} updated in workshop ${context.workshopId} by membership ${context.membershipId}.`,
    );
    return this.toDetailResponse(order);
  }

  async changeStatus(
    context: WorkshopContext,
    serviceOrderId: string,
    dto: ChangeStatusDto,
  ): Promise<ServiceOrderDetailResponseDto> {
    const order = await this.prisma.$transaction(async (tx) => {
      const changerUserId = await this.resolveUserId(tx, context);

      const existing = await tx.serviceOrder.findFirst({
        where: { id: serviceOrderId, workshopId: context.workshopId },
        select: { id: true, status: true, code: true },
      });

      if (!existing) {
        throw new NotFoundException('Service order not found.');
      }

      const allowed = ALLOWED_TRANSITIONS[existing.status];
      if (!allowed.includes(dto.status)) {
        throw new BadRequestException(
          `Cannot transition from ${existing.status} to ${dto.status}.`,
        );
      }

      const closedAt =
        dto.status === ServiceOrderStatus.DELIVERED ||
        dto.status === ServiceOrderStatus.CANCELLED
          ? new Date()
          : undefined;

      const updated = await tx.serviceOrder.update({
        where: { id: existing.id },
        data: {
          status: dto.status,
          ...(closedAt ? { closedAt } : {}),
          statusHistory: {
            create: {
              previousStatus: existing.status,
              newStatus: dto.status,
              changedById: changerUserId,
              comment: dto.comment ?? null,
            },
          },
        },
        include: ORDER_DETAIL_INCLUDE,
      });

      return updated;
    });

    this.logger.log(
      `Service order ${order.id} status changed to ${order.status} in workshop ${context.workshopId} by membership ${context.membershipId}.`,
    );
    return this.toDetailResponse(order);
  }

  async assignTechnician(
    context: WorkshopContext,
    serviceOrderId: string,
    dto: AssignTechnicianDto,
  ): Promise<ServiceOrderDetailResponseDto> {
    const order = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.serviceOrder.findFirst({
        where: { id: serviceOrderId, workshopId: context.workshopId },
        select: { id: true, status: true },
      });

      if (!existing) {
        throw new NotFoundException('Service order not found.');
      }

      let assignedTechnicianId: string | null = null;
      if (dto.technicianId) {
        assignedTechnicianId = await this.resolveTechnicianUserId(
          tx,
          context,
          dto.technicianId,
        );
      }

      return tx.serviceOrder.update({
        where: { id: existing.id },
        data: { assignedTechnicianId },
        include: ORDER_DETAIL_INCLUDE,
      });
    });

    this.logger.log(
      `Service order ${order.id} technician updated in workshop ${context.workshopId} by membership ${context.membershipId}.`,
    );
    return this.toDetailResponse(order);
  }

  private async assertCustomerExists(
    tx: Prisma.TransactionClient,
    context: WorkshopContext,
    customerId: string,
  ): Promise<void> {
    const customer = await tx.customer.findFirst({
      where: { id: customerId, workshopId: context.workshopId },
      select: { id: true },
    });
    if (!customer) {
      throw new NotFoundException('Customer not found.');
    }
  }

  private async assertVehicleBelongsToCustomer(
    tx: Prisma.TransactionClient,
    context: WorkshopContext,
    vehicleId: string,
    customerId: string,
  ): Promise<void> {
    const vehicle = await tx.vehicle.findFirst({
      where: { id: vehicleId, customerId, workshopId: context.workshopId },
      select: { id: true },
    });
    if (!vehicle) {
      throw new NotFoundException('Vehicle not found for this customer.');
    }
  }

  private async resolveUserId(
    tx: Prisma.TransactionClient,
    context: WorkshopContext,
  ): Promise<string> {
    const membership = await tx.membership.findFirst({
      where: { id: context.membershipId, workshopId: context.workshopId },
      select: { userId: true },
    });
    if (!membership) {
      throw new NotFoundException('Membership not found.');
    }
    return membership.userId;
  }

  private async resolveTechnicianUserId(
    tx: Prisma.TransactionClient,
    context: WorkshopContext,
    technicianId: string,
  ): Promise<string> {
    const membership = await tx.membership.findFirst({
      where: {
        id: technicianId,
        workshopId: context.workshopId,
        isActive: true,
      },
      select: { userId: true },
    });
    if (!membership) {
      throw new NotFoundException('Technician not found.');
    }
    return membership.userId;
  }

  private async generateCode(
    tx: Prisma.TransactionClient,
    workshopId: string,
  ): Promise<string> {
    const last = await tx.serviceOrder.findFirst({
      where: { workshopId },
      orderBy: { code: 'desc' },
      select: { code: true },
    });
    const match = last?.code.match(/^SO-(\d+)$/);
    const nextNum = match ? parseInt(match[1], 10) + 1 : 1;
    return `SO-${String(nextNum).padStart(4, '0')}`;
  }

  private toResponse(order: OrderWithRelations): ServiceOrderResponseDto {
    return {
      id: order.id,
      code: order.code,
      workshopId: order.workshopId,
      customerId: order.customerId,
      customer: { id: order.customer.id, fullName: order.customer.fullName },
      vehicleId: order.vehicleId,
      vehicle: {
        id: order.vehicle.id,
        plate: order.vehicle.plate,
        brand: order.vehicle.brand,
        model: order.vehicle.model,
      },
      assignedTechnicianId: order.assignedTechnicianId,
      assignedTechnician: order.assignedTechnician
        ? {
            userId: order.assignedTechnician.userId,
            displayName: order.assignedTechnician.displayName,
          }
        : null,
      status: order.status,
      priority: order.priority ?? null,
      reportedIssues: order.reportedIssues,
      receptionNotes: order.receptionNotes,
      mileageIn: order.mileageIn,
      fuelLevel: order.fuelLevel ?? null,
      estimatedDeliveryDate: order.estimatedDeliveryDate
        ? order.estimatedDeliveryDate.toISOString().split('T')[0]
        : null,
      diagnosisCount: order._count.diagnoses,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }

  private toDetailResponse(
    order: OrderDetailWithRelations,
  ): ServiceOrderDetailResponseDto {
    return {
      ...this.toResponse(order as unknown as OrderWithRelations),
      createdBy: {
        userId: order.createdBy.userId,
        displayName: order.createdBy.displayName,
      },
      statusHistory: order.statusHistory.map((h) => ({
        id: h.id,
        previousStatus: h.previousStatus ?? null,
        newStatus: h.newStatus,
        changedBy: {
          userId: h.changedBy.userId,
          displayName: h.changedBy.displayName,
        },
        comment: h.comment ?? null,
        createdAt: h.createdAt,
      })),
    };
  }
}
