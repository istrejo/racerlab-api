import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { WorkshopContext } from '../../common/auth/workshop-context';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { CustomerPageResponseDto } from './dto/customer-page-response.dto';
import { CustomerResponseDto } from './dto/customer-response.dto';
import {
  CustomerSort,
  ListCustomersQueryDto,
} from './dto/list-customers-query.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

const CUSTOMER_COUNTS = {
  select: { vehicles: true, serviceOrders: true },
} as const;

type CustomerWithCounts = Prisma.CustomerGetPayload<{
  include: { _count: typeof CUSTOMER_COUNTS };
}>;

@Injectable()
export class CustomersService {
  private readonly logger = new Logger(CustomersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(
    context: WorkshopContext,
    dto: CreateCustomerDto,
  ): Promise<CustomerResponseDto> {
    try {
      const customer = await this.prisma.customer.create({
        data: {
          workshopId: context.workshopId,
          fullName: dto.fullName.trim(),
          phone: this.normalizeNullable(dto.phone),
          whatsapp: this.normalizeNullable(dto.whatsapp),
          email: this.normalizeEmail(dto.email),
          document: this.normalizeDocument(dto.document),
          address: this.normalizeNullable(dto.address),
          notes: this.normalizeNullable(dto.notes),
        },
        include: { _count: CUSTOMER_COUNTS },
      });

      this.logger.log(
        `Customer ${customer.id} created in workshop ${context.workshopId} by membership ${context.membershipId}.`,
      );
      return this.toResponse(customer);
    } catch (error) {
      this.rethrowWriteError(error);
    }
  }

  async list(
    context: WorkshopContext,
    query: ListCustomersQueryDto,
  ): Promise<CustomerPageResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const search = query.search?.trim();
    const where: Prisma.CustomerWhereInput = {
      workshopId: context.workshopId,
      ...(query.hasVehicles === undefined
        ? {}
        : {
            vehicles: query.hasVehicles ? { some: {} } : { none: {} },
          }),
      ...(query.hasServiceOrders === undefined
        ? {}
        : {
            serviceOrders: query.hasServiceOrders ? { some: {} } : { none: {} },
          }),
      ...(search
        ? {
            OR: [
              { fullName: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search, mode: 'insensitive' } },
              { whatsapp: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              {
                document: {
                  contains: this.normalizeDocument(search) ?? search,
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
    };

    const [customers, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where,
        include: { _count: CUSTOMER_COUNTS },
        orderBy: this.customerOrderBy(query.sort),
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.customer.count({ where }),
    ]);

    return {
      items: customers.map((customer) => this.toResponse(customer)),
      page,
      limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    };
  }

  async findOne(
    context: WorkshopContext,
    customerId: string,
  ): Promise<CustomerResponseDto> {
    const customer = await this.findScoped(context, customerId);

    if (!customer) {
      throw new NotFoundException('Customer not found.');
    }

    return this.toResponse(customer);
  }

  async update(
    context: WorkshopContext,
    customerId: string,
    dto: UpdateCustomerDto,
  ): Promise<CustomerResponseDto> {
    try {
      const customer = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.customer.findFirst({
          where: { id: customerId, workshopId: context.workshopId },
          select: { id: true },
        });

        if (!existing) {
          throw new NotFoundException('Customer not found.');
        }

        return tx.customer.update({
          where: { id: existing.id },
          data: {
            ...(dto.fullName === undefined
              ? {}
              : { fullName: dto.fullName.trim() }),
            ...(dto.phone === undefined
              ? {}
              : { phone: this.normalizeNullable(dto.phone) }),
            ...(dto.whatsapp === undefined
              ? {}
              : { whatsapp: this.normalizeNullable(dto.whatsapp) }),
            ...(dto.email === undefined
              ? {}
              : { email: this.normalizeEmail(dto.email) }),
            ...(dto.document === undefined
              ? {}
              : { document: this.normalizeDocument(dto.document) }),
            ...(dto.address === undefined
              ? {}
              : { address: this.normalizeNullable(dto.address) }),
            ...(dto.notes === undefined
              ? {}
              : { notes: this.normalizeNullable(dto.notes) }),
          },
          include: { _count: CUSTOMER_COUNTS },
        });
      });

      this.logger.log(
        `Customer ${customer.id} updated in workshop ${context.workshopId} by membership ${context.membershipId}.`,
      );
      return this.toResponse(customer);
    } catch (error) {
      this.rethrowWriteError(error);
    }
  }

  async remove(context: WorkshopContext, customerId: string): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        const customer = await tx.customer.findFirst({
          where: { id: customerId, workshopId: context.workshopId },
          include: { _count: CUSTOMER_COUNTS },
        });

        if (!customer) {
          throw new NotFoundException('Customer not found.');
        }

        if (customer._count.vehicles > 0 || customer._count.serviceOrders > 0) {
          throw new ConflictException(
            'Customers with vehicles or service orders cannot be deleted.',
          );
        }

        await tx.customer.delete({ where: { id: customer.id } });
      });

      this.logger.log(
        `Customer ${customerId} deleted from workshop ${context.workshopId} by membership ${context.membershipId}.`,
      );
    } catch (error) {
      this.rethrowWriteError(error);
    }
  }

  private findScoped(context: WorkshopContext, customerId: string) {
    return this.prisma.customer.findFirst({
      where: { id: customerId, workshopId: context.workshopId },
      include: { _count: CUSTOMER_COUNTS },
    });
  }

  private customerOrderBy(
    sort: CustomerSort | undefined,
  ): Prisma.CustomerOrderByWithRelationInput[] {
    switch (sort) {
      case CustomerSort.NAME_DESC:
        return [{ fullName: 'desc' }, { id: 'asc' }];
      case CustomerSort.NEWEST:
        return [{ createdAt: 'desc' }, { id: 'asc' }];
      case CustomerSort.OLDEST:
        return [{ createdAt: 'asc' }, { id: 'asc' }];
      case CustomerSort.NAME_ASC:
      default:
        return [{ fullName: 'asc' }, { id: 'asc' }];
    }
  }

  private normalizeNullable(value: string | null | undefined): string | null {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }

  private normalizeEmail(value: string | null | undefined): string | null {
    return this.normalizeNullable(value)?.toLowerCase() ?? null;
  }

  private normalizeDocument(value: string | null | undefined): string | null {
    const normalized = this.normalizeNullable(value)
      ?.replace(/[\s-]+/g, '')
      .toUpperCase();
    return normalized || null;
  }

  private toResponse(customer: CustomerWithCounts): CustomerResponseDto {
    return {
      id: customer.id,
      fullName: customer.fullName,
      phone: customer.phone,
      whatsapp: customer.whatsapp,
      email: customer.email,
      document: customer.document,
      address: customer.address,
      notes: customer.notes,
      vehicleCount: customer._count.vehicles,
      serviceOrderCount: customer._count.serviceOrders,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
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
        'A customer with this document already exists in the workshop.',
      );
    }

    if (this.isPrismaError(error, 'P2003')) {
      throw new ConflictException(
        'Customers with vehicles or service orders cannot be deleted.',
      );
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
