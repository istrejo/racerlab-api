import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { WorkshopContext } from '../../common/auth/workshop-context';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { ListVehiclesQueryDto } from './dto/list-vehicles-query.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { VehiclePageResponseDto } from './dto/vehicle-page-response.dto';
import { VehicleResponseDto } from './dto/vehicle-response.dto';
import { VehicleWithCustomerPageResponseDto } from './dto/vehicle-with-customer-page-response.dto';
import { VehicleWithCustomerResponseDto } from './dto/vehicle-with-customer-response.dto';

const VEHICLE_COUNTS = {
  select: { serviceOrders: true },
} as const;

const VEHICLE_CUSTOMER = {
  select: { id: true, fullName: true },
} as const;

type VehicleWithCounts = Prisma.VehicleGetPayload<{
  include: { _count: typeof VEHICLE_COUNTS };
}>;

type VehicleWithCustomer = Prisma.VehicleGetPayload<{
  include: { _count: typeof VEHICLE_COUNTS; customer: typeof VEHICLE_CUSTOMER };
}>;

@Injectable()
export class VehiclesService {
  private readonly logger = new Logger(VehiclesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(
    context: WorkshopContext,
    customerId: string,
    dto: CreateVehicleDto,
  ): Promise<VehicleResponseDto> {
    await this.assertCustomerExists(context, customerId);

    try {
      const vehicle = await this.prisma.vehicle.create({
        data: {
          workshopId: context.workshopId,
          customerId,
          plate: this.normalizePlate(dto.plate),
          brand: dto.brand.trim(),
          model: dto.model.trim(),
          year: dto.year ?? null,
          color: this.normalizeNullable(dto.color),
          vin: this.normalizeNullable(dto.vin),
          mileage: dto.mileage ?? null,
          vehicleType: this.normalizeNullable(dto.vehicleType),
          notes: this.normalizeNullable(dto.notes),
        },
        include: { _count: VEHICLE_COUNTS },
      });

      this.logger.log(
        `Vehicle ${vehicle.id} created for customer ${customerId} in workshop ${context.workshopId} by membership ${context.membershipId}.`,
      );
      return this.toResponse(vehicle);
    } catch (error) {
      this.rethrowWriteError(error);
    }
  }

  async list(
    context: WorkshopContext,
    customerId: string,
    query: ListVehiclesQueryDto,
  ): Promise<VehiclePageResponseDto> {
    await this.assertCustomerExists(context, customerId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const search = query.search?.trim();

    const where: Prisma.VehicleWhereInput = {
      workshopId: context.workshopId,
      customerId,
      ...(search
        ? {
            OR: [
              { plate: { contains: search, mode: 'insensitive' } },
              { brand: { contains: search, mode: 'insensitive' } },
              { model: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [vehicles, total] = await this.prisma.$transaction([
      this.prisma.vehicle.findMany({
        where,
        include: { _count: VEHICLE_COUNTS },
        orderBy: [{ brand: 'asc' }, { model: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.vehicle.count({ where }),
    ]);

    return {
      items: vehicles.map((vehicle) => this.toResponse(vehicle)),
      page,
      limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    };
  }

  async listForWorkshop(
    context: WorkshopContext,
    query: ListVehiclesQueryDto,
  ): Promise<VehicleWithCustomerPageResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const search = query.search?.trim();

    const where: Prisma.VehicleWhereInput = {
      workshopId: context.workshopId,
      ...(search
        ? {
            OR: [
              { plate: { contains: search, mode: 'insensitive' } },
              { brand: { contains: search, mode: 'insensitive' } },
              { model: { contains: search, mode: 'insensitive' } },
              {
                customer: {
                  fullName: { contains: search, mode: 'insensitive' },
                },
              },
            ],
          }
        : {}),
    };

    const [vehicles, total] = await this.prisma.$transaction([
      this.prisma.vehicle.findMany({
        where,
        include: { _count: VEHICLE_COUNTS, customer: VEHICLE_CUSTOMER },
        orderBy: [{ plate: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.vehicle.count({ where }),
    ]);

    return {
      items: vehicles.map((vehicle) => this.toCustomerResponse(vehicle)),
      page,
      limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    };
  }

  async findOne(
    context: WorkshopContext,
    customerId: string,
    vehicleId: string,
  ): Promise<VehicleResponseDto> {
    const vehicle = await this.findScoped(context, customerId, vehicleId);

    if (!vehicle) {
      throw new NotFoundException('Vehicle not found.');
    }

    return this.toResponse(vehicle);
  }

  async update(
    context: WorkshopContext,
    customerId: string,
    vehicleId: string,
    dto: UpdateVehicleDto,
  ): Promise<VehicleResponseDto> {
    try {
      const vehicle = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.vehicle.findFirst({
          where: {
            id: vehicleId,
            workshopId: context.workshopId,
            customerId,
          },
          select: { id: true },
        });

        if (!existing) {
          throw new NotFoundException('Vehicle not found.');
        }

        return tx.vehicle.update({
          where: { id: existing.id },
          data: {
            ...(dto.plate === undefined
              ? {}
              : { plate: this.normalizePlate(dto.plate) }),
            ...(dto.brand === undefined ? {} : { brand: dto.brand.trim() }),
            ...(dto.model === undefined ? {} : { model: dto.model.trim() }),
            ...(dto.year === undefined ? {} : { year: dto.year ?? null }),
            ...(dto.color === undefined
              ? {}
              : { color: this.normalizeNullable(dto.color) }),
            ...(dto.vin === undefined
              ? {}
              : { vin: this.normalizeNullable(dto.vin) }),
            ...(dto.mileage === undefined
              ? {}
              : { mileage: dto.mileage ?? null }),
            ...(dto.vehicleType === undefined
              ? {}
              : { vehicleType: this.normalizeNullable(dto.vehicleType) }),
            ...(dto.notes === undefined
              ? {}
              : { notes: this.normalizeNullable(dto.notes) }),
          },
          include: { _count: VEHICLE_COUNTS },
        });
      });

      this.logger.log(
        `Vehicle ${vehicle.id} updated in workshop ${context.workshopId} by membership ${context.membershipId}.`,
      );
      return this.toResponse(vehicle);
    } catch (error) {
      this.rethrowWriteError(error);
    }
  }

  async remove(
    context: WorkshopContext,
    customerId: string,
    vehicleId: string,
  ): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        const vehicle = await tx.vehicle.findFirst({
          where: {
            id: vehicleId,
            workshopId: context.workshopId,
            customerId,
          },
          include: { _count: VEHICLE_COUNTS },
        });

        if (!vehicle) {
          throw new NotFoundException('Vehicle not found.');
        }

        if (vehicle._count.serviceOrders > 0) {
          throw new ConflictException(
            'Vehicles with service orders cannot be deleted.',
          );
        }

        await tx.vehicle.delete({ where: { id: vehicle.id } });
      });

      this.logger.log(
        `Vehicle ${vehicleId} deleted from workshop ${context.workshopId} by membership ${context.membershipId}.`,
      );
    } catch (error) {
      this.rethrowWriteError(error);
    }
  }

  private async assertCustomerExists(
    context: WorkshopContext,
    customerId: string,
  ): Promise<void> {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, workshopId: context.workshopId },
      select: { id: true },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found.');
    }
  }

  private findScoped(
    context: WorkshopContext,
    customerId: string,
    vehicleId: string,
  ) {
    return this.prisma.vehicle.findFirst({
      where: {
        id: vehicleId,
        workshopId: context.workshopId,
        customerId,
      },
      include: { _count: VEHICLE_COUNTS },
    });
  }

  private normalizePlate(value: string): string {
    return value.trim().replace(/\s+/g, '').toUpperCase();
  }

  private normalizeNullable(value: string | null | undefined): string | null {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }

  private toResponse(vehicle: VehicleWithCounts): VehicleResponseDto {
    return {
      id: vehicle.id,
      customerId: vehicle.customerId,
      plate: vehicle.plate,
      brand: vehicle.brand,
      model: vehicle.model,
      year: vehicle.year,
      color: vehicle.color,
      vin: vehicle.vin,
      mileage: vehicle.mileage,
      vehicleType: vehicle.vehicleType,
      notes: vehicle.notes,
      serviceOrderCount: vehicle._count.serviceOrders,
      createdAt: vehicle.createdAt,
      updatedAt: vehicle.updatedAt,
    };
  }

  private toCustomerResponse(
    vehicle: VehicleWithCustomer,
  ): VehicleWithCustomerResponseDto {
    return {
      ...this.toResponse(vehicle),
      customer: {
        id: vehicle.customer.id,
        fullName: vehicle.customer.fullName,
      },
    };
  }

  private rethrowWriteError(error: unknown): never {
    if (
      error instanceof NotFoundException ||
      error instanceof ConflictException
    ) {
      throw error;
    }

    if (this.isPrismaError(error, 'P2002')) {
      throw new ConflictException(
        'A vehicle with this plate already exists in the workshop.',
      );
    }

    if (this.isPrismaError(error, 'P2003')) {
      throw new NotFoundException('Customer not found.');
    }

    throw error;
  }

  private isPrismaError(error: unknown, code: string): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === code
    );
  }
}
