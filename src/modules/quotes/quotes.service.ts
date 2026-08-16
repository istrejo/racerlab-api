import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, QuoteStatus, ServiceOrderStatus } from '@prisma/client';
import type { WorkshopContext } from '../../common/auth/workshop-context';
import { PrismaService } from '../../prisma/prisma.service';
import { ChangeQuoteStatusDto } from './dto/change-quote-status.dto';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { ListQuotesQueryDto } from './dto/list-quotes-query.dto';
import { QuoteItemInputDto } from './dto/quote-item-input.dto';
import { QuotePageResponseDto } from './dto/quote-page-response.dto';
import { QuoteResponseDto } from './dto/quote-response.dto';
import { QuoteSummaryResponseDto } from './dto/quote-summary-response.dto';
import { UpdateQuoteDto } from './dto/update-quote.dto';

const ALLOWED_TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = {
  [QuoteStatus.DRAFT]: [QuoteStatus.ACTIVE, QuoteStatus.CANCELLED],
  [QuoteStatus.ACTIVE]: [
    QuoteStatus.APPROVED,
    QuoteStatus.REJECTED,
    QuoteStatus.EXPIRED,
    QuoteStatus.CANCELLED,
  ],
  [QuoteStatus.APPROVED]: [],
  [QuoteStatus.REJECTED]: [],
  [QuoteStatus.EXPIRED]: [],
  [QuoteStatus.CANCELLED]: [],
};

const QUOTE_INCLUDE = {
  createdBy: { select: { userId: true, displayName: true } },
  items: { orderBy: { createdAt: 'asc' as const } },
} as const;

const QUOTE_SUMMARY_INCLUDE = {
  createdBy: { select: { userId: true, displayName: true } },
  _count: { select: { items: true } },
  serviceOrder: {
    select: {
      id: true,
      code: true,
      status: true,
      customer: { select: { id: true, fullName: true } },
      vehicle: { select: { id: true, plate: true, brand: true, model: true } },
    },
  },
} as const;

type QuoteWithRelations = Prisma.QuoteGetPayload<{
  include: typeof QUOTE_INCLUDE;
}>;

type QuoteSummaryWithRelations = Prisma.QuoteGetPayload<{
  include: typeof QUOTE_SUMMARY_INCLUDE;
}>;

type QuoteTotals = {
  subtotal: Prisma.Decimal;
  discount: Prisma.Decimal | null;
  tax: Prisma.Decimal | null;
  total: Prisma.Decimal;
  itemTotals: Prisma.Decimal[];
};

@Injectable()
export class QuotesService {
  private readonly logger = new Logger(QuotesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(
    context: WorkshopContext,
    serviceOrderId: string,
    dto: CreateQuoteDto,
  ): Promise<QuoteResponseDto> {
    const quote = await this.prisma.$transaction(async (tx) => {
      await this.assertServiceOrderExists(tx, context, serviceOrderId);
      const creatorUserId = await this.resolveUserId(tx, context);
      const totals = this.computeTotals(
        dto.items,
        dto.discount ?? null,
        dto.tax ?? null,
      );

      return tx.quote.create({
        data: {
          workshopId: context.workshopId,
          serviceOrderId,
          createdById: creatorUserId,
          subtotal: totals.subtotal,
          discount: totals.discount,
          tax: totals.tax,
          total: totals.total,
          items: {
            create: dto.items.map((item, index) => ({
              type: item.type,
              description: item.description,
              quantity: new Prisma.Decimal(item.quantity),
              unitPrice: new Prisma.Decimal(item.unitPrice),
              costPrice:
                item.costPrice != null
                  ? new Prisma.Decimal(item.costPrice)
                  : null,
              total: totals.itemTotals[index],
            })),
          },
        },
        include: QUOTE_INCLUDE,
      });
    });

    this.logger.log(
      `Quote ${quote.id} created for service order ${serviceOrderId} in workshop ${context.workshopId} by membership ${context.membershipId}.`,
    );
    return this.toResponse(quote);
  }

  async listForWorkshop(
    context: WorkshopContext,
    query: ListQuotesQueryDto,
  ): Promise<QuotePageResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const search = query.search?.trim();

    const where: Prisma.QuoteWhereInput = {
      workshopId: context.workshopId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.serviceOrderId ? { serviceOrderId: query.serviceOrderId } : {}),
      ...(search
        ? {
            OR: [
              {
                serviceOrder: {
                  code: { contains: search, mode: 'insensitive' },
                },
              },
              {
                serviceOrder: {
                  customer: {
                    fullName: { contains: search, mode: 'insensitive' },
                  },
                },
              },
              {
                serviceOrder: {
                  vehicle: { plate: { contains: search, mode: 'insensitive' } },
                },
              },
            ],
          }
        : {}),
    };

    const [quotes, total] = await this.prisma.$transaction([
      this.prisma.quote.findMany({
        where,
        include: QUOTE_SUMMARY_INCLUDE,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.quote.count({ where }),
    ]);

    return {
      items: quotes.map((quote) => this.toSummaryResponse(quote)),
      page,
      limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    };
  }

  async list(
    context: WorkshopContext,
    serviceOrderId: string,
  ): Promise<QuoteResponseDto[]> {
    await this.assertServiceOrderExists(this.prisma, context, serviceOrderId);

    const quotes = await this.prisma.quote.findMany({
      where: { serviceOrderId, workshopId: context.workshopId },
      include: QUOTE_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });

    return quotes.map((quote) => this.toResponse(quote));
  }

  async findOne(
    context: WorkshopContext,
    serviceOrderId: string,
    quoteId: string,
  ): Promise<QuoteResponseDto> {
    const quote = await this.prisma.quote.findFirst({
      where: { id: quoteId, serviceOrderId, workshopId: context.workshopId },
      include: QUOTE_INCLUDE,
    });

    if (!quote) {
      throw new NotFoundException('Quote not found.');
    }

    return this.toResponse(quote);
  }

  async update(
    context: WorkshopContext,
    serviceOrderId: string,
    quoteId: string,
    dto: UpdateQuoteDto,
  ): Promise<QuoteResponseDto> {
    const quote = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.quote.findFirst({
        where: { id: quoteId, serviceOrderId, workshopId: context.workshopId },
        include: { items: { orderBy: { createdAt: 'asc' as const } } },
      });

      if (!existing) {
        throw new NotFoundException('Quote not found.');
      }

      if (existing.status !== QuoteStatus.DRAFT) {
        throw new ConflictException('Only draft quotes can be edited.');
      }

      const effectiveItems: QuoteItemInputDto[] =
        dto.items ??
        existing.items.map((item) => ({
          type: item.type,
          description: item.description,
          quantity: item.quantity.toNumber(),
          unitPrice: item.unitPrice.toNumber(),
          costPrice: item.costPrice ? item.costPrice.toNumber() : null,
        }));

      const discount =
        dto.discount !== undefined
          ? (dto.discount ?? null)
          : existing.discount
            ? existing.discount.toNumber()
            : null;
      const tax =
        dto.tax !== undefined
          ? (dto.tax ?? null)
          : existing.tax
            ? existing.tax.toNumber()
            : null;

      const totals = this.computeTotals(effectiveItems, discount, tax);

      if (dto.items) {
        await tx.quoteItem.deleteMany({
          where: { quoteId: existing.id, workshopId: context.workshopId },
        });
      }

      return tx.quote.update({
        where: { id: existing.id },
        data: {
          subtotal: totals.subtotal,
          discount: totals.discount,
          tax: totals.tax,
          total: totals.total,
          ...(dto.items
            ? {
                items: {
                  create: dto.items.map((item, index) => ({
                    type: item.type,
                    description: item.description,
                    quantity: new Prisma.Decimal(item.quantity),
                    unitPrice: new Prisma.Decimal(item.unitPrice),
                    costPrice:
                      item.costPrice != null
                        ? new Prisma.Decimal(item.costPrice)
                        : null,
                    total: totals.itemTotals[index],
                  })),
                },
              }
            : {}),
        },
        include: QUOTE_INCLUDE,
      });
    });

    this.logger.log(
      `Quote ${quote.id} updated in workshop ${context.workshopId} by membership ${context.membershipId}.`,
    );
    return this.toResponse(quote);
  }

  async changeStatus(
    context: WorkshopContext,
    serviceOrderId: string,
    quoteId: string,
    dto: ChangeQuoteStatusDto,
  ): Promise<QuoteResponseDto> {
    const quote = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.quote.findFirst({
        where: { id: quoteId, serviceOrderId, workshopId: context.workshopId },
        select: { id: true, status: true },
      });

      if (!existing) {
        throw new NotFoundException('Quote not found.');
      }

      const allowed = ALLOWED_TRANSITIONS[existing.status];
      if (!allowed.includes(dto.status)) {
        throw new BadRequestException(
          `Cannot transition quote from ${existing.status} to ${dto.status}.`,
        );
      }

      if (
        dto.status === QuoteStatus.ACTIVE ||
        dto.status === QuoteStatus.APPROVED
      ) {
        const conflicting = await tx.quote.findFirst({
          where: {
            serviceOrderId,
            workshopId: context.workshopId,
            id: { not: existing.id },
            status: { in: [QuoteStatus.ACTIVE, QuoteStatus.APPROVED] },
          },
          select: { id: true },
        });
        if (conflicting) {
          throw new ConflictException(
            'Another quote is already active or approved for this service order.',
          );
        }
      }

      const requiresMethod =
        dto.status === QuoteStatus.APPROVED ||
        dto.status === QuoteStatus.REJECTED;
      if (requiresMethod && !dto.approvalMethod) {
        throw new BadRequestException(
          'approvalMethod is required to approve or reject a quote.',
        );
      }

      const updated = await tx.quote.update({
        where: { id: existing.id },
        data: {
          status: dto.status,
          ...(dto.status === QuoteStatus.APPROVED
            ? { approvalMethod: dto.approvalMethod, approvedAt: new Date() }
            : {}),
          ...(dto.status === QuoteStatus.REJECTED
            ? { approvalMethod: dto.approvalMethod, rejectedAt: new Date() }
            : {}),
        },
        include: QUOTE_INCLUDE,
      });

      if (dto.status === QuoteStatus.APPROVED) {
        await this.syncServiceOrderApproval(tx, context, serviceOrderId);
      }

      return updated;
    });

    this.logger.log(
      `Quote ${quote.id} status changed to ${quote.status} in workshop ${context.workshopId} by membership ${context.membershipId}.`,
    );
    return this.toResponse(quote);
  }

  private async syncServiceOrderApproval(
    tx: Prisma.TransactionClient,
    context: WorkshopContext,
    serviceOrderId: string,
  ): Promise<void> {
    const order = await tx.serviceOrder.findFirst({
      where: { id: serviceOrderId, workshopId: context.workshopId },
      select: { id: true, status: true },
    });

    if (!order || order.status !== ServiceOrderStatus.QUOTED) {
      return;
    }

    const changerUserId = await this.resolveUserId(tx, context);

    await tx.serviceOrder.update({
      where: { id: order.id },
      data: {
        status: ServiceOrderStatus.APPROVED,
        statusHistory: {
          create: {
            previousStatus: order.status,
            newStatus: ServiceOrderStatus.APPROVED,
            changedById: changerUserId,
            comment: 'Quote approved.',
          },
        },
      },
    });
  }

  private computeTotals(
    items: QuoteItemInputDto[],
    discount: number | null,
    tax: number | null,
  ): QuoteTotals {
    const itemTotals = items.map((item) =>
      new Prisma.Decimal(item.quantity)
        .mul(new Prisma.Decimal(item.unitPrice))
        .toDecimalPlaces(2),
    );
    const subtotal = itemTotals
      .reduce((acc, total) => acc.add(total), new Prisma.Decimal(0))
      .toDecimalPlaces(2);
    const discountDecimal =
      discount != null ? new Prisma.Decimal(discount) : null;
    const taxDecimal = tax != null ? new Prisma.Decimal(tax) : null;

    if (discountDecimal && discountDecimal.greaterThan(subtotal)) {
      throw new BadRequestException('Discount cannot exceed the subtotal.');
    }

    const total = subtotal
      .minus(discountDecimal ?? 0)
      .plus(taxDecimal ?? 0)
      .toDecimalPlaces(2);

    return {
      subtotal,
      discount: discountDecimal,
      tax: taxDecimal,
      total,
      itemTotals,
    };
  }

  private async assertServiceOrderExists(
    tx: Prisma.TransactionClient | PrismaService,
    context: WorkshopContext,
    serviceOrderId: string,
  ): Promise<void> {
    const order = await (tx as Prisma.TransactionClient).serviceOrder.findFirst(
      {
        where: { id: serviceOrderId, workshopId: context.workshopId },
        select: { id: true },
      },
    );
    if (!order) {
      throw new NotFoundException('Service order not found.');
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

  private toSummaryResponse(
    quote: QuoteSummaryWithRelations,
  ): QuoteSummaryResponseDto {
    return {
      id: quote.id,
      status: quote.status,
      total: quote.total.toNumber(),
      itemCount: quote._count.items,
      serviceOrder: {
        id: quote.serviceOrder.id,
        code: quote.serviceOrder.code,
        status: quote.serviceOrder.status,
      },
      customer: {
        id: quote.serviceOrder.customer.id,
        fullName: quote.serviceOrder.customer.fullName,
      },
      vehicle: {
        id: quote.serviceOrder.vehicle.id,
        plate: quote.serviceOrder.vehicle.plate,
        brand: quote.serviceOrder.vehicle.brand,
        model: quote.serviceOrder.vehicle.model,
      },
      createdBy: {
        userId: quote.createdBy.userId,
        displayName: quote.createdBy.displayName,
      },
      createdAt: quote.createdAt,
    };
  }

  private toResponse(quote: QuoteWithRelations): QuoteResponseDto {
    return {
      id: quote.id,
      serviceOrderId: quote.serviceOrderId,
      status: quote.status,
      subtotal: quote.subtotal.toNumber(),
      discount: quote.discount ? quote.discount.toNumber() : null,
      tax: quote.tax ? quote.tax.toNumber() : null,
      total: quote.total.toNumber(),
      approvalMethod: quote.approvalMethod,
      approvedAt: quote.approvedAt,
      rejectedAt: quote.rejectedAt,
      createdBy: {
        userId: quote.createdBy.userId,
        displayName: quote.createdBy.displayName,
      },
      items: quote.items.map((item) => ({
        id: item.id,
        type: item.type,
        description: item.description,
        quantity: item.quantity.toNumber(),
        unitPrice: item.unitPrice.toNumber(),
        costPrice: item.costPrice ? item.costPrice.toNumber() : null,
        total: item.total.toNumber(),
        inventoryProductId: item.inventoryProductId,
        isApproved: item.isApproved,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
      createdAt: quote.createdAt,
      updatedAt: quote.updatedAt,
    };
  }
}
