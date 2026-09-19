import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  QuoteApprovalMethod,
  QuoteItemType,
  QuoteStatus,
  ServiceOrderStatus,
  UserRole,
} from '@prisma/client';
import { QuotesService } from './quotes.service';

type DecimalLike = { toNumber(): number };

type QuoteWriteArgs = {
  data: {
    status?: QuoteStatus;
    version?: number;
    sourceQuoteId?: string | null;
    currencyCode?: string;
    subtotal?: DecimalLike;
    discount?: DecimalLike;
    tax?: DecimalLike;
    total?: DecimalLike;
    approvalMethod?: QuoteApprovalMethod | null;
    approvalMethodDetail?: string | null;
    approvedAt?: Date | null;
    rejectedAt?: Date | null;
    items?: {
      create: Array<{ description: string; total: DecimalLike }>;
    };
  };
};

type QuoteQueryArgs = {
  where: Record<string, unknown> & { OR?: unknown[] };
};

/** Reads one argument of a recorded mock call without leaking `any`. */
const callArg = <T>(fn: jest.Mock, index = 0): T =>
  (fn.mock.calls as unknown as unknown[][])[index][0] as T;

describe('QuotesService', () => {
  const context = {
    workshopId: 'e79033dc-7d16-421f-ae1a-d216f9a306d7',
    membershipId: '6650e2ef-c46a-4fe2-875e-4af7c576e12d',
    role: UserRole.ADVISOR,
  };
  const serviceOrderId = 'o1b2a3d4-0000-0000-0000-000000000001';
  const quoteId = 'q1b2a3d4-0000-0000-0000-000000000001';
  const advisorUserId = 'u1b2a3d4-0000-0000-0000-000000000001';
  const now = new Date('2026-08-15T12:00:00.000Z');

  const baseItem = {
    id: 'i1b2a3d4-0000-0000-0000-000000000001',
    workshopId: context.workshopId,
    quoteId,
    inventoryProductId: null,
    type: QuoteItemType.PART,
    description: 'Pastillas de freno',
    quantity: new Prisma.Decimal(2),
    unitPrice: new Prisma.Decimal('45.50'),
    costPrice: null,
    total: new Prisma.Decimal('91.00'),
    isApproved: null,
    createdAt: now,
    updatedAt: now,
  };

  const baseQuote = {
    id: quoteId,
    workshopId: context.workshopId,
    serviceOrderId,
    createdById: advisorUserId,
    status: QuoteStatus.DRAFT,
    version: 1,
    sourceQuoteId: null,
    currencyCode: 'EUR',
    subtotal: new Prisma.Decimal('91.00'),
    discount: null,
    tax: null,
    total: new Prisma.Decimal('91.00'),
    approvalMethod: null,
    approvalMethodDetail: null,
    approvedAt: null,
    rejectedAt: null,
    createdAt: now,
    updatedAt: now,
    createdBy: { userId: advisorUserId, displayName: 'Ana Asesora' },
    items: [baseItem],
  };

  const summaryQuote = {
    id: quoteId,
    status: QuoteStatus.ACTIVE,
    version: 2,
    currencyCode: 'EUR',
    total: new Prisma.Decimal('91.00'),
    createdAt: now,
    createdBy: { userId: advisorUserId, displayName: 'Ana Asesora' },
    _count: { items: 1 },
    serviceOrder: {
      id: serviceOrderId,
      code: 'SO-0001',
      status: ServiceOrderStatus.QUOTED,
      customer: {
        id: 'c1b2a3d4-0000-0000-0000-000000000001',
        fullName: 'María García',
      },
      vehicle: {
        id: 'v1b2a3d4-0000-0000-0000-000000000001',
        plate: 'ABC1234',
        brand: 'Toyota',
        model: 'Corolla',
      },
    },
  };

  const prisma = {
    membership: { findFirst: jest.fn() },
    serviceOrder: { findFirst: jest.fn(), update: jest.fn() },
    quote: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
    quoteItem: { deleteMany: jest.fn() },
    $queryRaw: jest.fn(),
    $transaction: jest.fn(),
  };

  const service = new QuotesService(prisma as never);

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation(
      (value: unknown[] | ((tx: typeof prisma) => unknown)) =>
        Array.isArray(value) ? Promise.all(value) : value(prisma),
    );
    prisma.$queryRaw.mockResolvedValue([
      { id: serviceOrderId, status: ServiceOrderStatus.QUOTED },
    ]);
    prisma.serviceOrder.findFirst.mockResolvedValue({
      id: serviceOrderId,
      status: ServiceOrderStatus.QUOTED,
    });
    prisma.membership.findFirst.mockResolvedValue({ userId: advisorUserId });
    prisma.quote.findFirst.mockResolvedValue(null);
  });

  describe('create', () => {
    it('creates a draft quote with computed totals', async () => {
      prisma.quote.create.mockResolvedValue(baseQuote);

      const result = await service.create(context, serviceOrderId, {
        items: [
          {
            type: QuoteItemType.PART,
            description: 'Pastillas de freno',
            quantity: 2,
            unitPrice: 45.5,
          },
        ],
      });

      expect(result).toMatchObject({
        id: quoteId,
        serviceOrderId,
        status: QuoteStatus.DRAFT,
        subtotal: 91,
        total: 91,
      });
      const createArgs = callArg<QuoteWriteArgs>(prisma.quote.create);
      expect(createArgs.data.subtotal!.toNumber()).toBe(91);
      expect(createArgs.data.total!.toNumber()).toBe(91);
      expect(createArgs.data.items!.create[0].total.toNumber()).toBe(91);
    });

    it('creates version 1 in EUR when no currency is supplied', async () => {
      prisma.quote.create.mockResolvedValue(baseQuote);

      const result = await service.create(context, serviceOrderId, {
        items: [
          {
            type: QuoteItemType.PART,
            description: 'Pastillas de freno',
            quantity: 2,
            unitPrice: 45.5,
          },
        ],
      });

      expect(result).toMatchObject({
        version: 1,
        sourceQuoteId: null,
        currencyCode: 'EUR',
      });
      const createArgs = callArg<QuoteWriteArgs>(prisma.quote.create);
      expect(createArgs.data.version).toBe(1);
      expect(createArgs.data.sourceQuoteId).toBeNull();
      expect(createArgs.data.currencyCode).toBe('EUR');
    });

    it('persists an explicit currency code', async () => {
      prisma.quote.create.mockResolvedValue({
        ...baseQuote,
        currencyCode: 'USD',
      });

      await service.create(context, serviceOrderId, {
        items: [
          {
            type: QuoteItemType.PART,
            description: 'Pastillas de freno',
            quantity: 1,
            unitPrice: 10,
          },
        ],
        currencyCode: 'USD',
      });

      expect(
        callArg<QuoteWriteArgs>(prisma.quote.create).data.currencyCode,
      ).toBe('USD');
    });

    it('rejects a second initial quote for the same service order', async () => {
      prisma.quote.findFirst.mockResolvedValue({ id: quoteId });

      await expect(
        service.create(context, serviceOrderId, {
          items: [
            {
              type: QuoteItemType.PART,
              description: 'x',
              quantity: 1,
              unitPrice: 1,
            },
          ],
        }),
      ).rejects.toEqual(
        new ConflictException(
          'This service order already has a quote. Create a new version instead.',
        ),
      );
      expect(prisma.quote.create).not.toHaveBeenCalled();
    });

    it('rejects creation when the service order stage is not quotable', async () => {
      prisma.$queryRaw.mockResolvedValue([
        { id: serviceOrderId, status: ServiceOrderStatus.IN_PROGRESS },
      ]);

      await expect(
        service.create(context, serviceOrderId, {
          items: [
            {
              type: QuoteItemType.PART,
              description: 'x',
              quantity: 1,
              unitPrice: 1,
            },
          ],
        }),
      ).rejects.toEqual(
        new ConflictException(
          'Quotes can only be written while the service order is in DIAGNOSIS or QUOTED.',
        ),
      );
      expect(prisma.quote.create).not.toHaveBeenCalled();
    });

    it('translates a unique-constraint race into a conflict', async () => {
      prisma.quote.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: '6.0.0',
        }),
      );

      await expect(
        service.create(context, serviceOrderId, {
          items: [
            {
              type: QuoteItemType.PART,
              description: 'x',
              quantity: 1,
              unitPrice: 1,
            },
          ],
        }),
      ).rejects.toEqual(
        new ConflictException(
          'Another quote for this service order was created concurrently.',
        ),
      );
    });

    it('applies discount and tax to the total', async () => {
      prisma.quote.create.mockResolvedValue(baseQuote);

      await service.create(context, serviceOrderId, {
        items: [
          {
            type: QuoteItemType.LABOR,
            description: 'Mano de obra',
            quantity: 1,
            unitPrice: 100,
          },
        ],
        discount: 10,
        tax: 16,
      });

      const createArgs = callArg<QuoteWriteArgs>(prisma.quote.create);
      expect(createArgs.data.subtotal!.toNumber()).toBe(100);
      expect(createArgs.data.discount!.toNumber()).toBe(10);
      expect(createArgs.data.tax!.toNumber()).toBe(16);
      expect(createArgs.data.total!.toNumber()).toBe(106);
    });

    it('rejects a discount greater than the subtotal', async () => {
      await expect(
        service.create(context, serviceOrderId, {
          items: [
            {
              type: QuoteItemType.OTHER,
              description: 'Insumos',
              quantity: 1,
              unitPrice: 50,
            },
          ],
          discount: 60,
        }),
      ).rejects.toEqual(
        new BadRequestException('Discount cannot exceed the subtotal.'),
      );
      expect(prisma.quote.create).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when service order does not exist', async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      await expect(
        service.create(context, serviceOrderId, {
          items: [
            {
              type: QuoteItemType.PART,
              description: 'x',
              quantity: 1,
              unitPrice: 1,
            },
          ],
        }),
      ).rejects.toEqual(new NotFoundException('Service order not found.'));
    });
  });

  describe('list / findOne', () => {
    it('lists quotes scoped to service order and workshop', async () => {
      prisma.quote.findMany.mockResolvedValue([baseQuote]);

      const result = await service.list(context, serviceOrderId);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ id: quoteId, total: 91 });
      expect(prisma.quote.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { serviceOrderId, workshopId: context.workshopId },
        }),
      );
    });

    it('returns the newest version first', async () => {
      prisma.quote.findMany.mockResolvedValue([baseQuote]);

      await service.list(context, serviceOrderId);

      expect(prisma.quote.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { version: 'desc' } }),
      );
    });

    it('does not leak quotes from another workshop', async () => {
      prisma.quote.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne(context, serviceOrderId, quoteId),
      ).rejects.toEqual(new NotFoundException('Quote not found.'));
      expect(prisma.quote.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: quoteId,
            serviceOrderId,
            workshopId: context.workshopId,
          },
        }),
      );
    });

    it('throws NotFoundException when fetching a quote from another order', async () => {
      prisma.quote.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne(context, serviceOrderId, quoteId),
      ).rejects.toEqual(new NotFoundException('Quote not found.'));
    });
  });

  describe('listForWorkshop', () => {
    beforeEach(() => {
      prisma.quote.findMany.mockResolvedValue([summaryQuote]);
      prisma.quote.count.mockResolvedValue(1);
    });

    it('returns a paginated summary scoped to the active workshop', async () => {
      const result = await service.listForWorkshop(context, {
        page: 1,
        limit: 20,
      });

      expect(result).toMatchObject({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      });
      expect(result.items[0]).toEqual({
        id: quoteId,
        status: QuoteStatus.ACTIVE,
        version: 2,
        currencyCode: 'EUR',
        total: 91,
        itemCount: 1,
        serviceOrder: {
          id: serviceOrderId,
          code: 'SO-0001',
          status: ServiceOrderStatus.QUOTED,
        },
        customer: {
          id: 'c1b2a3d4-0000-0000-0000-000000000001',
          fullName: 'María García',
        },
        vehicle: {
          id: 'v1b2a3d4-0000-0000-0000-000000000001',
          plate: 'ABC1234',
          brand: 'Toyota',
          model: 'Corolla',
        },
        createdBy: { userId: advisorUserId, displayName: 'Ana Asesora' },
        createdAt: now,
      });
      expect(prisma.quote.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { workshopId: context.workshopId },
        }),
      );
    });

    it('filters by status and service order', async () => {
      await service.listForWorkshop(context, {
        page: 1,
        limit: 20,
        status: QuoteStatus.ACTIVE,
        serviceOrderId,
      });

      expect(prisma.quote.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            workshopId: context.workshopId,
            status: QuoteStatus.ACTIVE,
            serviceOrderId,
          },
        }),
      );
    });

    it('searches by order code, customer name, and vehicle plate', async () => {
      await service.listForWorkshop(context, {
        page: 1,
        limit: 20,
        search: 'abc',
      });

      const { where } = callArg<QuoteQueryArgs>(prisma.quote.findMany);
      expect(where.OR).toEqual([
        { serviceOrder: { code: { contains: 'abc', mode: 'insensitive' } } },
        {
          serviceOrder: {
            customer: { fullName: { contains: 'abc', mode: 'insensitive' } },
          },
        },
        {
          serviceOrder: {
            vehicle: { plate: { contains: 'abc', mode: 'insensitive' } },
          },
        },
      ]);
    });

    it('skips rows for pages beyond the first', async () => {
      await service.listForWorkshop(context, { page: 3, limit: 10 });

      expect(prisma.quote.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
    });

    it('reports zero pages when no quote matches', async () => {
      prisma.quote.findMany.mockResolvedValue([]);
      prisma.quote.count.mockResolvedValue(0);

      const result = await service.listForWorkshop(context, {
        page: 1,
        limit: 20,
      });

      expect(result).toMatchObject({ items: [], total: 0, totalPages: 0 });
    });
  });

  describe('update', () => {
    it('recomputes totals when replacing items', async () => {
      prisma.quote.findFirst.mockResolvedValue(baseQuote);
      prisma.quote.update.mockResolvedValue(baseQuote);

      await service.update(context, serviceOrderId, quoteId, {
        items: [
          {
            type: QuoteItemType.PART,
            description: 'Filtro',
            quantity: 3,
            unitPrice: 20,
          },
        ],
      });

      expect(prisma.quoteItem.deleteMany).toHaveBeenCalledWith({
        where: { quoteId, workshopId: context.workshopId },
      });
      const updateArgs = callArg<QuoteWriteArgs>(prisma.quote.update);
      expect(updateArgs.data.subtotal!.toNumber()).toBe(60);
      expect(updateArgs.data.total!.toNumber()).toBe(60);
    });

    it('recomputes totals from existing items when only discount changes', async () => {
      prisma.quote.findFirst.mockResolvedValue(baseQuote);
      prisma.quote.update.mockResolvedValue(baseQuote);

      await service.update(context, serviceOrderId, quoteId, { discount: 11 });

      expect(prisma.quoteItem.deleteMany).not.toHaveBeenCalled();
      const updateArgs = callArg<QuoteWriteArgs>(prisma.quote.update);
      expect(updateArgs.data.subtotal!.toNumber()).toBe(91);
      expect(updateArgs.data.discount!.toNumber()).toBe(11);
      expect(updateArgs.data.total!.toNumber()).toBe(80);
    });

    it('persists a changed currency code', async () => {
      prisma.quote.findFirst.mockResolvedValue(baseQuote);
      prisma.quote.update.mockResolvedValue({
        ...baseQuote,
        currencyCode: 'USD',
      });

      await service.update(context, serviceOrderId, quoteId, {
        currencyCode: 'USD',
      });

      expect(
        callArg<QuoteWriteArgs>(prisma.quote.update).data.currencyCode,
      ).toBe('USD');
    });

    it('keeps the stored currency when none is supplied', async () => {
      prisma.quote.findFirst.mockResolvedValue(baseQuote);
      prisma.quote.update.mockResolvedValue(baseQuote);

      await service.update(context, serviceOrderId, quoteId, { discount: 5 });

      expect(
        callArg<QuoteWriteArgs>(prisma.quote.update).data.currencyCode,
      ).toBeUndefined();
    });

    it('rejects edits while the service order stage is not quotable', async () => {
      prisma.$queryRaw.mockResolvedValue([
        { id: serviceOrderId, status: ServiceOrderStatus.IN_PROGRESS },
      ]);

      await expect(
        service.update(context, serviceOrderId, quoteId, { discount: 5 }),
      ).rejects.toEqual(
        new ConflictException(
          'Quotes can only be written while the service order is in DIAGNOSIS or QUOTED.',
        ),
      );
      expect(prisma.quote.update).not.toHaveBeenCalled();
    });

    it('rejects edits on non-draft quotes', async () => {
      prisma.quote.findFirst.mockResolvedValue({
        ...baseQuote,
        status: QuoteStatus.ACTIVE,
      });

      await expect(
        service.update(context, serviceOrderId, quoteId, { discount: 5 }),
      ).rejects.toEqual(
        new ConflictException('Only draft quotes can be edited.'),
      );
      expect(prisma.quote.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the quote does not exist', async () => {
      prisma.quote.findFirst.mockResolvedValue(null);

      await expect(
        service.update(context, serviceOrderId, quoteId, { discount: 5 }),
      ).rejects.toEqual(new NotFoundException('Quote not found.'));
    });
  });

  describe('createVersion', () => {
    const sourceQuote = {
      ...baseQuote,
      status: QuoteStatus.REJECTED,
      version: 2,
      currencyCode: 'USD',
      discount: new Prisma.Decimal('5.00'),
      tax: new Prisma.Decimal('3.00'),
      approvalMethod: QuoteApprovalMethod.PHONE,
      approvalMethodDetail: 'Customer declined',
      rejectedAt: now,
    };

    const findLatest = () => callArg<QuoteQueryArgs>(prisma.quote.findFirst);

    /** Routes each lookup the service makes: source, newer version, open draft. */
    const stubLookups = (
      overrides: {
        source?: unknown;
        newer?: unknown;
        draft?: unknown;
      } = {},
    ) => {
      prisma.quote.findFirst.mockImplementation(
        ({ where }: { where: Record<string, unknown> }) => {
          if (where.id) {
            return Promise.resolve(
              'source' in overrides ? overrides.source : sourceQuote,
            );
          }
          if (where.version) {
            return Promise.resolve(overrides.newer ?? null);
          }
          return Promise.resolve(overrides.draft ?? null);
        },
      );
    };

    beforeEach(() => {
      stubLookups();
      prisma.quote.create.mockResolvedValue({
        ...baseQuote,
        id: 'q1b2a3d4-0000-0000-0000-000000000002',
        version: 3,
        sourceQuoteId: quoteId,
        currencyCode: 'USD',
      });
    });

    it('clones the source quote into the next draft version', async () => {
      const result = await service.createVersion(
        context,
        serviceOrderId,
        quoteId,
      );

      expect(result).toMatchObject({
        version: 3,
        sourceQuoteId: quoteId,
        status: QuoteStatus.DRAFT,
        currencyCode: 'USD',
      });
      const { data } = callArg<QuoteWriteArgs>(prisma.quote.create);
      expect(data.version).toBe(3);
      expect(data.sourceQuoteId).toBe(quoteId);
      expect(data.status).toBe(QuoteStatus.DRAFT);
      expect(data.currencyCode).toBe('USD');
      expect(data.discount!.toNumber()).toBe(5);
      expect(data.tax!.toNumber()).toBe(3);
      expect(data.items!.create).toHaveLength(1);
      expect(data.items!.create[0].description).toBe('Pastillas de freno');
    });

    it('clears the customer decision on the cloned draft', async () => {
      await service.createVersion(context, serviceOrderId, quoteId);

      const { data } = callArg<QuoteWriteArgs>(prisma.quote.create);
      expect(data.approvalMethod).toBeNull();
      expect(data.approvalMethodDetail).toBeNull();
      expect(data.approvedAt).toBeNull();
      expect(data.rejectedAt).toBeNull();
    });

    it('resolves the source scoped to the workshop and service order', async () => {
      await service.createVersion(context, serviceOrderId, quoteId);

      expect(findLatest().where).toEqual({
        id: quoteId,
        serviceOrderId,
        workshopId: context.workshopId,
      });
    });

    it('throws NotFoundException for a foreign or missing source quote', async () => {
      stubLookups({ source: null });

      await expect(
        service.createVersion(context, serviceOrderId, quoteId),
      ).rejects.toEqual(new NotFoundException('Quote not found.'));
      expect(prisma.quote.create).not.toHaveBeenCalled();
    });

    it.each([QuoteStatus.DRAFT, QuoteStatus.APPROVED])(
      'refuses to clone a %s quote',
      async (status) => {
        stubLookups({ source: { ...sourceQuote, status } });

        await expect(
          service.createVersion(context, serviceOrderId, quoteId),
        ).rejects.toEqual(
          new ConflictException(
            `A quote in status ${status} cannot be versioned.`,
          ),
        );
        expect(prisma.quote.create).not.toHaveBeenCalled();
      },
    );

    it('refuses to clone a quote that is not the latest version', async () => {
      stubLookups({ newer: { id: 'newer-quote' } });

      await expect(
        service.createVersion(context, serviceOrderId, quoteId),
      ).rejects.toEqual(
        new ConflictException('Only the latest quote version can be cloned.'),
      );
      expect(prisma.quote.create).not.toHaveBeenCalled();
    });

    it('refuses to create a second draft for the same service order', async () => {
      stubLookups({ draft: { id: 'existing-draft' } });

      await expect(
        service.createVersion(context, serviceOrderId, quoteId),
      ).rejects.toEqual(
        new ConflictException('This service order already has a draft quote.'),
      );
      expect(prisma.quote.create).not.toHaveBeenCalled();
    });

    it('refuses to version while the order stage is not quotable', async () => {
      prisma.$queryRaw.mockResolvedValue([
        { id: serviceOrderId, status: ServiceOrderStatus.DELIVERED },
      ]);

      await expect(
        service.createVersion(context, serviceOrderId, quoteId),
      ).rejects.toEqual(
        new ConflictException(
          'Quotes can only be written while the service order is in DIAGNOSIS or QUOTED.',
        ),
      );
    });

    it('throws NotFoundException when the service order does not exist', async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      await expect(
        service.createVersion(context, serviceOrderId, quoteId),
      ).rejects.toEqual(new NotFoundException('Service order not found.'));
    });

    it('translates a concurrent version race into a conflict', async () => {
      prisma.quote.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: '6.0.0',
        }),
      );

      await expect(
        service.createVersion(context, serviceOrderId, quoteId),
      ).rejects.toEqual(
        new ConflictException(
          'Another quote version for this service order was created concurrently.',
        ),
      );
    });
  });

  describe('changeStatus', () => {
    it('activates a draft quote when no other quote is active', async () => {
      prisma.quote.findFirst
        .mockResolvedValueOnce({ id: quoteId, status: QuoteStatus.DRAFT })
        .mockResolvedValueOnce(null);
      prisma.quote.update.mockResolvedValue({
        ...baseQuote,
        status: QuoteStatus.ACTIVE,
      });

      const result = await service.changeStatus(
        context,
        serviceOrderId,
        quoteId,
        {
          status: QuoteStatus.ACTIVE,
        },
      );

      expect(result.status).toBe(QuoteStatus.ACTIVE);
    });

    it('supersedes the former active quote when a newer draft is activated', async () => {
      prisma.quote.findFirst
        .mockResolvedValueOnce({ id: quoteId, status: QuoteStatus.DRAFT })
        .mockResolvedValueOnce(null);
      prisma.quote.update.mockResolvedValue({
        ...baseQuote,
        status: QuoteStatus.ACTIVE,
      });

      await service.changeStatus(context, serviceOrderId, quoteId, {
        status: QuoteStatus.ACTIVE,
      });

      expect(prisma.quote.updateMany).toHaveBeenCalledWith({
        where: {
          serviceOrderId,
          workshopId: context.workshopId,
          id: { not: quoteId },
          status: QuoteStatus.ACTIVE,
        },
        data: { status: QuoteStatus.SUPERSEDED },
      });
    });

    it('rejects activation when another quote is already approved', async () => {
      prisma.quote.findFirst
        .mockResolvedValueOnce({ id: quoteId, status: QuoteStatus.DRAFT })
        .mockResolvedValueOnce({ id: 'other-quote' });

      await expect(
        service.changeStatus(context, serviceOrderId, quoteId, {
          status: QuoteStatus.ACTIVE,
        }),
      ).rejects.toEqual(
        new ConflictException(
          'Another quote is already approved for this service order.',
        ),
      );
      expect(prisma.quote.update).not.toHaveBeenCalled();
    });

    it('moves the service order from DIAGNOSIS to QUOTED with history on activation', async () => {
      prisma.$queryRaw.mockResolvedValue([
        { id: serviceOrderId, status: ServiceOrderStatus.DIAGNOSIS },
      ]);
      prisma.quote.findFirst
        .mockResolvedValueOnce({ id: quoteId, status: QuoteStatus.DRAFT })
        .mockResolvedValueOnce(null);
      prisma.quote.update.mockResolvedValue({
        ...baseQuote,
        status: QuoteStatus.ACTIVE,
      });

      await service.changeStatus(context, serviceOrderId, quoteId, {
        status: QuoteStatus.ACTIVE,
      });

      expect(prisma.serviceOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: ServiceOrderStatus.QUOTED,
            statusHistory: {
              create: expect.objectContaining({
                previousStatus: ServiceOrderStatus.DIAGNOSIS,
                newStatus: ServiceOrderStatus.QUOTED,
                changedById: advisorUserId,
              }),
            },
          }),
        }),
      );
    });

    it('leaves an already QUOTED order untouched on activation', async () => {
      prisma.quote.findFirst
        .mockResolvedValueOnce({ id: quoteId, status: QuoteStatus.DRAFT })
        .mockResolvedValueOnce(null);
      prisma.quote.update.mockResolvedValue({
        ...baseQuote,
        status: QuoteStatus.ACTIVE,
      });

      await service.changeStatus(context, serviceOrderId, quoteId, {
        status: QuoteStatus.ACTIVE,
      });

      expect(prisma.serviceOrder.update).not.toHaveBeenCalled();
    });

    it('translates a concurrent activation into a conflict', async () => {
      prisma.quote.findFirst
        .mockResolvedValueOnce({ id: quoteId, status: QuoteStatus.DRAFT })
        .mockResolvedValueOnce(null);
      prisma.quote.update.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: '6.0.0',
        }),
      );

      await expect(
        service.changeStatus(context, serviceOrderId, quoteId, {
          status: QuoteStatus.ACTIVE,
        }),
      ).rejects.toEqual(
        new ConflictException(
          'Another quote for this service order changed status concurrently.',
        ),
      );
    });

    it('rejects invalid transitions', async () => {
      prisma.quote.findFirst.mockResolvedValue({
        id: quoteId,
        status: QuoteStatus.DRAFT,
      });

      await expect(
        service.changeStatus(context, serviceOrderId, quoteId, {
          status: QuoteStatus.APPROVED,
          approvalMethod: 'WHATSAPP',
        }),
      ).rejects.toEqual(
        new BadRequestException(
          'Cannot transition quote from DRAFT to APPROVED.',
        ),
      );
    });

    it('requires approvalMethod when approving', async () => {
      prisma.quote.findFirst
        .mockResolvedValueOnce({ id: quoteId, status: QuoteStatus.ACTIVE })
        .mockResolvedValueOnce(null);

      await expect(
        service.changeStatus(context, serviceOrderId, quoteId, {
          status: QuoteStatus.APPROVED,
        }),
      ).rejects.toEqual(
        new BadRequestException(
          'approvalMethod is required to approve or reject a quote.',
        ),
      );
    });

    it('approves an active quote, records the method, and syncs the service order', async () => {
      prisma.quote.findFirst
        .mockResolvedValueOnce({ id: quoteId, status: QuoteStatus.ACTIVE })
        .mockResolvedValueOnce(null);
      prisma.quote.update.mockResolvedValue({
        ...baseQuote,
        status: QuoteStatus.APPROVED,
        approvalMethod: 'WHATSAPP',
        approvedAt: now,
      });

      const result = await service.changeStatus(
        context,
        serviceOrderId,
        quoteId,
        {
          status: QuoteStatus.APPROVED,
          approvalMethod: 'WHATSAPP',
        },
      );

      expect(result.status).toBe(QuoteStatus.APPROVED);
      expect(result.approvalMethod).toBe('WHATSAPP');
      expect(prisma.quote.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: QuoteStatus.APPROVED,
            approvalMethod: 'WHATSAPP',
            approvedAt: expect.any(Date),
          }),
        }),
      );
      expect(prisma.serviceOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: ServiceOrderStatus.APPROVED,
            statusHistory: {
              create: expect.objectContaining({
                previousStatus: ServiceOrderStatus.QUOTED,
                newStatus: ServiceOrderStatus.APPROVED,
                changedById: advisorUserId,
              }),
            },
          }),
        }),
      );
    });

    it('reports state drift instead of silently skipping the order sync', async () => {
      prisma.$queryRaw.mockResolvedValue([
        { id: serviceOrderId, status: ServiceOrderStatus.DIAGNOSIS },
      ]);
      prisma.quote.findFirst
        .mockResolvedValueOnce({ id: quoteId, status: QuoteStatus.ACTIVE })
        .mockResolvedValueOnce(null);

      await expect(
        service.changeStatus(context, serviceOrderId, quoteId, {
          status: QuoteStatus.APPROVED,
          approvalMethod: QuoteApprovalMethod.EMAIL,
        }),
      ).rejects.toEqual(
        new ConflictException(
          'The service order is no longer in QUOTED status.',
        ),
      );
      expect(prisma.quote.update).not.toHaveBeenCalled();
      expect(prisma.serviceOrder.update).not.toHaveBeenCalled();
    });

    it('requires a detail when the approval method is OTHER', async () => {
      prisma.quote.findFirst
        .mockResolvedValueOnce({ id: quoteId, status: QuoteStatus.ACTIVE })
        .mockResolvedValueOnce(null);

      await expect(
        service.changeStatus(context, serviceOrderId, quoteId, {
          status: QuoteStatus.APPROVED,
          approvalMethod: QuoteApprovalMethod.OTHER,
        }),
      ).rejects.toEqual(
        new BadRequestException(
          'approvalMethodDetail is required when the approval method is OTHER.',
        ),
      );
    });

    it('rejects a detail for methods other than OTHER', async () => {
      prisma.quote.findFirst
        .mockResolvedValueOnce({ id: quoteId, status: QuoteStatus.ACTIVE })
        .mockResolvedValueOnce(null);

      await expect(
        service.changeStatus(context, serviceOrderId, quoteId, {
          status: QuoteStatus.APPROVED,
          approvalMethod: QuoteApprovalMethod.PHONE,
          approvalMethodDetail: 'Spoke to the owner',
        }),
      ).rejects.toEqual(
        new BadRequestException(
          'approvalMethodDetail is only allowed when the approval method is OTHER.',
        ),
      );
    });

    it('rejects decision fields on non-decision transitions', async () => {
      prisma.quote.findFirst.mockResolvedValueOnce({
        id: quoteId,
        status: QuoteStatus.ACTIVE,
      });

      await expect(
        service.changeStatus(context, serviceOrderId, quoteId, {
          status: QuoteStatus.EXPIRED,
          approvalMethod: QuoteApprovalMethod.PHONE,
        }),
      ).rejects.toEqual(
        new BadRequestException(
          'approvalMethod and approvalMethodDetail are only allowed when approving or rejecting.',
        ),
      );
    });

    it('persists the OTHER method together with its detail', async () => {
      prisma.quote.findFirst
        .mockResolvedValueOnce({ id: quoteId, status: QuoteStatus.ACTIVE })
        .mockResolvedValueOnce(null);
      prisma.quote.update.mockResolvedValue({
        ...baseQuote,
        status: QuoteStatus.APPROVED,
        approvalMethod: QuoteApprovalMethod.OTHER,
        approvalMethodDetail: 'Signed on the shop tablet',
        approvedAt: now,
      });

      const result = await service.changeStatus(
        context,
        serviceOrderId,
        quoteId,
        {
          status: QuoteStatus.APPROVED,
          approvalMethod: QuoteApprovalMethod.OTHER,
          approvalMethodDetail: 'Signed on the shop tablet',
        },
      );

      expect(result.approvalMethodDetail).toBe('Signed on the shop tablet');
      expect(prisma.quote.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            approvalMethod: QuoteApprovalMethod.OTHER,
            approvalMethodDetail: 'Signed on the shop tablet',
          }),
        }),
      );
    });

    it.each([
      [QuoteStatus.APPROVED, QuoteStatus.ACTIVE],
      [QuoteStatus.REJECTED, QuoteStatus.ACTIVE],
      [QuoteStatus.EXPIRED, QuoteStatus.ACTIVE],
      [QuoteStatus.CANCELLED, QuoteStatus.ACTIVE],
      [QuoteStatus.SUPERSEDED, QuoteStatus.ACTIVE],
    ])('refuses to transition out of a terminal %s quote', async (from, to) => {
      prisma.quote.findFirst.mockResolvedValueOnce({
        id: quoteId,
        status: from,
      });

      await expect(
        service.changeStatus(context, serviceOrderId, quoteId, {
          status: to,
        }),
      ).rejects.toEqual(
        new BadRequestException(
          `Cannot transition quote from ${from} to ${to}.`,
        ),
      );
      expect(prisma.quote.update).not.toHaveBeenCalled();
    });

    it('records rejectedAt and the method when rejecting', async () => {
      prisma.quote.findFirst.mockResolvedValueOnce({
        id: quoteId,
        status: QuoteStatus.ACTIVE,
      });
      prisma.quote.update.mockResolvedValue({
        ...baseQuote,
        status: QuoteStatus.REJECTED,
        approvalMethod: 'PHONE',
        rejectedAt: now,
      });

      const result = await service.changeStatus(
        context,
        serviceOrderId,
        quoteId,
        {
          status: QuoteStatus.REJECTED,
          approvalMethod: 'PHONE',
        },
      );

      expect(result.status).toBe(QuoteStatus.REJECTED);
      expect(prisma.quote.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: QuoteStatus.REJECTED,
            approvalMethod: 'PHONE',
            rejectedAt: expect.any(Date),
          }),
        }),
      );
      expect(prisma.serviceOrder.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the quote does not exist', async () => {
      prisma.quote.findFirst.mockResolvedValue(null);

      await expect(
        service.changeStatus(context, serviceOrderId, quoteId, {
          status: QuoteStatus.ACTIVE,
        }),
      ).rejects.toEqual(new NotFoundException('Quote not found.'));
    });
  });
});
