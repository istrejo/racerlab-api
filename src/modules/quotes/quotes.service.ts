import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  QuoteApprovalMethod,
  QuoteStatus,
  ServiceOrderStatus,
} from '@prisma/client';
import type { WorkshopContext } from '../../common/auth/workshop-context';
import { PrismaService } from '../../prisma/prisma.service';
import { ChangeQuoteStatusDto } from './dto/change-quote-status.dto';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { DEFAULT_CURRENCY_CODE } from './dto/currency-code';
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
  [QuoteStatus.SUPERSEDED]: [],
};

/** Stages during which a quote may be created, edited, or versioned. */
const QUOTABLE_ORDER_STATUSES: ServiceOrderStatus[] = [
  ServiceOrderStatus.DIAGNOSIS,
  ServiceOrderStatus.QUOTED,
];

/** A quote may only be cloned once its own lifecycle has ended. */
const VERSIONABLE_QUOTE_STATUSES: QuoteStatus[] = [
  QuoteStatus.ACTIVE,
  QuoteStatus.REJECTED,
  QuoteStatus.EXPIRED,
  QuoteStatus.CANCELLED,
  QuoteStatus.SUPERSEDED,
];

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
      await this.lockQuotableServiceOrder(tx, context, serviceOrderId);

      const existing = await tx.quote.findFirst({
        where: { serviceOrderId, workshopId: context.workshopId },
        select: { id: true },
      });
      if (existing) {
        throw new ConflictException(
          'This service order already has a quote. Create a new version instead.',
        );
      }

      const creatorUserId = await this.resolveUserId(tx, context);
      const totals = this.computeTotals(
        dto.items,
        dto.discount ?? null,
        dto.tax ?? null,
      );

      return this.translateWriteConflict(
        () =>
          tx.quote.create({
            data: {
              workshopId: context.workshopId,
              serviceOrderId,
              createdById: creatorUserId,
              version: 1,
              sourceQuoteId: null,
              currencyCode: dto.currencyCode ?? DEFAULT_CURRENCY_CODE,
              subtotal: totals.subtotal,
              discount: totals.discount,
              tax: totals.tax,
              total: totals.total,
              items: {
                create: this.buildItemInputs(dto.items, totals),
              },
            },
            include: QUOTE_INCLUDE,
          }),
        'Another quote for this service order was created concurrently.',
      );
    });

    this.logger.log(
      `Quote ${quote.id} created for service order ${serviceOrderId} in workshop ${context.workshopId} by membership ${context.membershipId}.`,
    );
    return this.toResponse(quote);
  }

  async createVersion(
    context: WorkshopContext,
    serviceOrderId: string,
    quoteId: string,
  ): Promise<QuoteResponseDto> {
    const quote = await this.prisma.$transaction(async (tx) => {
      await this.lockQuotableServiceOrder(tx, context, serviceOrderId);

      const source = await tx.quote.findFirst({
        where: { id: quoteId, serviceOrderId, workshopId: context.workshopId },
        include: QUOTE_INCLUDE,
      });

      if (!source) {
        throw new NotFoundException('Quote not found.');
      }

      if (!VERSIONABLE_QUOTE_STATUSES.includes(source.status)) {
        throw new ConflictException(
          `A quote in status ${source.status} cannot be versioned.`,
        );
      }

      const newer = await tx.quote.findFirst({
        where: {
          serviceOrderId,
          workshopId: context.workshopId,
          version: { gt: source.version },
        },
        select: { id: true },
      });
      if (newer) {
        throw new ConflictException(
          'Only the latest quote version can be cloned.',
        );
      }

      const existingDraft = await tx.quote.findFirst({
        where: {
          serviceOrderId,
          workshopId: context.workshopId,
          status: QuoteStatus.DRAFT,
        },
        select: { id: true },
      });
      if (existingDraft) {
        throw new ConflictException(
          'This service order already has a draft quote.',
        );
      }

      const creatorUserId = await this.resolveUserId(tx, context);

      return this.translateWriteConflict(
        () =>
          tx.quote.create({
            data: {
              workshopId: context.workshopId,
              serviceOrderId,
              createdById: creatorUserId,
              status: QuoteStatus.DRAFT,
              version: source.version + 1,
              sourceQuoteId: source.id,
              currencyCode: source.currencyCode,
              subtotal: source.subtotal,
              discount: source.discount,
              tax: source.tax,
              total: source.total,
              approvalMethod: null,
              approvalMethodDetail: null,
              approvedAt: null,
              rejectedAt: null,
              items: {
                create: source.items.map((item) => ({
                  type: item.type,
                  description: item.description,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  costPrice: item.costPrice,
                  total: item.total,
                  inventoryProductId: item.inventoryProductId,
                })),
              },
            },
            include: QUOTE_INCLUDE,
          }),
        'Another quote version for this service order was created concurrently.',
      );
    });

    this.logger.log(
      `Quote ${quote.id} created as version ${quote.version} from ${quoteId} in workshop ${context.workshopId} by membership ${context.membershipId}.`,
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
        orderBy: [{ createdAt: 'desc' }, { version: 'desc' }, { id: 'asc' }],
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
      orderBy: { version: 'desc' },
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
      await this.lockQuotableServiceOrder(tx, context, serviceOrderId);

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
          ...(dto.currencyCode ? { currencyCode: dto.currencyCode } : {}),
          ...(dto.items
            ? {
                items: { create: this.buildItemInputs(dto.items, totals) },
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
      const order = await this.lockServiceOrder(tx, context, serviceOrderId);

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

      this.assertDecisionIsConsistent(dto);

      if (dto.status === QuoteStatus.ACTIVE) {
        await this.assertNoApprovedQuote(
          tx,
          context,
          serviceOrderId,
          existing.id,
        );
      }

      if (dto.status === QuoteStatus.APPROVED) {
        await this.assertNoCompetingQuote(
          tx,
          context,
          serviceOrderId,
          existing.id,
        );
        if (order.status !== ServiceOrderStatus.QUOTED) {
          throw new ConflictException(
            'The service order is no longer in QUOTED status.',
          );
        }
      }

      // Supersede before activating so the partial unique index never sees two
      // ACTIVE rows for the order.
      if (dto.status === QuoteStatus.ACTIVE) {
        await tx.quote.updateMany({
          where: {
            serviceOrderId,
            workshopId: context.workshopId,
            id: { not: existing.id },
            status: QuoteStatus.ACTIVE,
          },
          data: { status: QuoteStatus.SUPERSEDED },
        });
      }

      const updated = await this.translateWriteConflict(
        () =>
          tx.quote.update({
            where: { id: existing.id },
            data: {
              status: dto.status,
              ...(dto.status === QuoteStatus.APPROVED
                ? {
                    approvalMethod: dto.approvalMethod,
                    approvalMethodDetail: dto.approvalMethodDetail ?? null,
                    approvedAt: new Date(),
                  }
                : {}),
              ...(dto.status === QuoteStatus.REJECTED
                ? {
                    approvalMethod: dto.approvalMethod,
                    approvalMethodDetail: dto.approvalMethodDetail ?? null,
                    rejectedAt: new Date(),
                  }
                : {}),
            },
            include: QUOTE_INCLUDE,
          }),
        'Another quote for this service order changed status concurrently.',
      );

      if (dto.status === QuoteStatus.ACTIVE) {
        await this.advanceOrder(
          tx,
          context,
          order,
          ServiceOrderStatus.DIAGNOSIS,
          ServiceOrderStatus.QUOTED,
          'Quote activated.',
        );
      }

      if (dto.status === QuoteStatus.APPROVED) {
        await this.advanceOrder(
          tx,
          context,
          order,
          ServiceOrderStatus.QUOTED,
          ServiceOrderStatus.APPROVED,
          'Quote approved.',
        );
      }

      return updated;
    });

    this.logger.log(
      `Quote ${quote.id} status changed to ${quote.status} in workshop ${context.workshopId} by membership ${context.membershipId}.`,
    );
    return this.toResponse(quote);
  }

  /**
   * Advances the locked order only when it still sits on the expected stage, so
   * a quote transition never rewrites an order that moved on independently.
   */
  private async advanceOrder(
    tx: Prisma.TransactionClient,
    context: WorkshopContext,
    order: { id: string; status: ServiceOrderStatus },
    from: ServiceOrderStatus,
    to: ServiceOrderStatus,
    comment: string,
  ): Promise<void> {
    if (order.status !== from) {
      return;
    }

    const changerUserId = await this.resolveUserId(tx, context);

    await tx.serviceOrder.update({
      where: { id: order.id },
      data: {
        status: to,
        statusHistory: {
          create: {
            previousStatus: from,
            newStatus: to,
            changedById: changerUserId,
            comment,
          },
        },
      },
    });
  }

  /** Approval is terminal, so an approved quote blocks any new activation. */
  private async assertNoApprovedQuote(
    tx: Prisma.TransactionClient,
    context: WorkshopContext,
    serviceOrderId: string,
    excludeQuoteId: string,
  ): Promise<void> {
    const approved = await tx.quote.findFirst({
      where: {
        serviceOrderId,
        workshopId: context.workshopId,
        id: { not: excludeQuoteId },
        status: QuoteStatus.APPROVED,
      },
      select: { id: true },
    });
    if (approved) {
      throw new ConflictException(
        'Another quote is already approved for this service order.',
      );
    }
  }

  private async assertNoCompetingQuote(
    tx: Prisma.TransactionClient,
    context: WorkshopContext,
    serviceOrderId: string,
    excludeQuoteId: string,
  ): Promise<void> {
    const conflicting = await tx.quote.findFirst({
      where: {
        serviceOrderId,
        workshopId: context.workshopId,
        id: { not: excludeQuoteId },
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

  /**
   * A decision needs a method; only `OTHER` carries free-text detail, and no
   * other transition may record either.
   */
  private assertDecisionIsConsistent(dto: ChangeQuoteStatusDto): void {
    const isDecision =
      dto.status === QuoteStatus.APPROVED ||
      dto.status === QuoteStatus.REJECTED;

    if (!isDecision) {
      if (dto.approvalMethod || dto.approvalMethodDetail) {
        throw new BadRequestException(
          'approvalMethod and approvalMethodDetail are only allowed when approving or rejecting.',
        );
      }
      return;
    }

    if (!dto.approvalMethod) {
      throw new BadRequestException(
        'approvalMethod is required to approve or reject a quote.',
      );
    }

    if (
      dto.approvalMethod === QuoteApprovalMethod.OTHER &&
      !dto.approvalMethodDetail
    ) {
      throw new BadRequestException(
        'approvalMethodDetail is required when the approval method is OTHER.',
      );
    }

    if (
      dto.approvalMethod !== QuoteApprovalMethod.OTHER &&
      dto.approvalMethodDetail
    ) {
      throw new BadRequestException(
        'approvalMethodDetail is only allowed when the approval method is OTHER.',
      );
    }
  }

  /** Line items always derive their persisted total from the computed totals. */
  private buildItemInputs(items: QuoteItemInputDto[], totals: QuoteTotals) {
    return items.map((item, index) => ({
      type: item.type,
      description: item.description,
      quantity: new Prisma.Decimal(item.quantity),
      unitPrice: new Prisma.Decimal(item.unitPrice),
      costPrice:
        item.costPrice != null ? new Prisma.Decimal(item.costPrice) : null,
      total: totals.itemTotals[index],
    }));
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

  /**
   * Serializes every quote write for one service order on the order row, so
   * version allocation and lifecycle checks cannot interleave. The partial
   * unique indexes remain the final guard.
   */
  private async lockQuotableServiceOrder(
    tx: Prisma.TransactionClient,
    context: WorkshopContext,
    serviceOrderId: string,
  ): Promise<{ id: string; status: ServiceOrderStatus }> {
    const order = await this.lockServiceOrder(tx, context, serviceOrderId);

    if (!QUOTABLE_ORDER_STATUSES.includes(order.status)) {
      throw new ConflictException(
        'Quotes can only be written while the service order is in DIAGNOSIS or QUOTED.',
      );
    }

    return order;
  }

  private async lockServiceOrder(
    tx: Prisma.TransactionClient,
    context: WorkshopContext,
    serviceOrderId: string,
  ): Promise<{ id: string; status: ServiceOrderStatus }> {
    const locked = await tx.$queryRaw<
      Array<{ id: string; status: ServiceOrderStatus }>
    >`
      SELECT "id", "status"
      FROM "service_orders"
      WHERE "id" = ${serviceOrderId}::uuid
        AND "workshop_id" = ${context.workshopId}::uuid
      FOR UPDATE
    `;

    if (locked.length !== 1) {
      throw new NotFoundException('Service order not found.');
    }

    return locked[0];
  }

  /**
   * The partial unique indexes are the authority on quote uniqueness, so a
   * losing concurrent writer surfaces as a conflict rather than a 500.
   */
  private async translateWriteConflict<T>(
    write: () => Promise<T>,
    message: string,
  ): Promise<T> {
    try {
      return await write();
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(message);
      }
      throw error;
    }
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
      version: quote.version,
      currencyCode: quote.currencyCode,
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
      version: quote.version,
      sourceQuoteId: quote.sourceQuoteId,
      currencyCode: quote.currencyCode,
      subtotal: quote.subtotal.toNumber(),
      discount: quote.discount ? quote.discount.toNumber() : null,
      tax: quote.tax ? quote.tax.toNumber() : null,
      total: quote.total.toNumber(),
      approvalMethod: quote.approvalMethod,
      approvalMethodDetail: quote.approvalMethodDetail,
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
