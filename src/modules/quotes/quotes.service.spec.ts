import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  QuoteItemType,
  QuoteStatus,
  ServiceOrderStatus,
  UserRole,
} from '@prisma/client';
import { QuotesService } from './quotes.service';

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
    subtotal: new Prisma.Decimal('91.00'),
    discount: null,
    tax: null,
    total: new Prisma.Decimal('91.00'),
    approvalMethod: null,
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
      count: jest.fn(),
    },
    quoteItem: { deleteMany: jest.fn() },
    $transaction: jest.fn(),
  };

  const service = new QuotesService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(
      (value: unknown[] | ((tx: typeof prisma) => unknown)) =>
        Array.isArray(value) ? Promise.all(value) : value(prisma),
    );
    prisma.serviceOrder.findFirst.mockResolvedValue({
      id: serviceOrderId,
      status: ServiceOrderStatus.QUOTED,
    });
    prisma.membership.findFirst.mockResolvedValue({ userId: advisorUserId });
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
      const createArgs = prisma.quote.create.mock.calls[0][0];
      expect(createArgs.data.subtotal.toNumber()).toBe(91);
      expect(createArgs.data.total.toNumber()).toBe(91);
      expect(createArgs.data.items.create[0].total.toNumber()).toBe(91);
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

      const createArgs = prisma.quote.create.mock.calls[0][0];
      expect(createArgs.data.subtotal.toNumber()).toBe(100);
      expect(createArgs.data.discount.toNumber()).toBe(10);
      expect(createArgs.data.tax.toNumber()).toBe(16);
      expect(createArgs.data.total.toNumber()).toBe(106);
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
      prisma.serviceOrder.findFirst.mockResolvedValue(null);

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

      const where = prisma.quote.findMany.mock.calls[0][0].where;
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
      const updateArgs = prisma.quote.update.mock.calls[0][0];
      expect(updateArgs.data.subtotal.toNumber()).toBe(60);
      expect(updateArgs.data.total.toNumber()).toBe(60);
    });

    it('recomputes totals from existing items when only discount changes', async () => {
      prisma.quote.findFirst.mockResolvedValue(baseQuote);
      prisma.quote.update.mockResolvedValue(baseQuote);

      await service.update(context, serviceOrderId, quoteId, { discount: 11 });

      expect(prisma.quoteItem.deleteMany).not.toHaveBeenCalled();
      const updateArgs = prisma.quote.update.mock.calls[0][0];
      expect(updateArgs.data.subtotal.toNumber()).toBe(91);
      expect(updateArgs.data.discount.toNumber()).toBe(11);
      expect(updateArgs.data.total.toNumber()).toBe(80);
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

    it('rejects activation when another quote is active or approved', async () => {
      prisma.quote.findFirst
        .mockResolvedValueOnce({ id: quoteId, status: QuoteStatus.DRAFT })
        .mockResolvedValueOnce({ id: 'other-quote' });

      await expect(
        service.changeStatus(context, serviceOrderId, quoteId, {
          status: QuoteStatus.ACTIVE,
        }),
      ).rejects.toEqual(
        new ConflictException(
          'Another quote is already active or approved for this service order.',
        ),
      );
      expect(prisma.quote.update).not.toHaveBeenCalled();
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

    it('does not sync the service order when it is not in QUOTED status', async () => {
      prisma.serviceOrder.findFirst.mockResolvedValue({
        id: serviceOrderId,
        status: ServiceOrderStatus.DIAGNOSIS,
      });
      prisma.quote.findFirst
        .mockResolvedValueOnce({ id: quoteId, status: QuoteStatus.ACTIVE })
        .mockResolvedValueOnce(null);
      prisma.quote.update.mockResolvedValue({
        ...baseQuote,
        status: QuoteStatus.APPROVED,
        approvalMethod: 'EMAIL',
        approvedAt: now,
      });

      await service.changeStatus(context, serviceOrderId, quoteId, {
        status: QuoteStatus.APPROVED,
        approvalMethod: 'EMAIL',
      });

      expect(prisma.serviceOrder.update).not.toHaveBeenCalled();
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
