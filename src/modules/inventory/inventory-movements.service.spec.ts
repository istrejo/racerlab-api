import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InventoryMovementType, Prisma, UserRole } from '@prisma/client';
import { InventoryMovementsService } from './inventory-movements.service';

describe('InventoryMovementsService', () => {
  const context = {
    workshopId: 'e79033dc-7d16-421f-ae1a-d216f9a306d7',
    membershipId: '6650e2ef-c46a-4fe2-875e-4af7c576e12d',
    role: UserRole.INVENTORY_MANAGER,
  };
  const actingUserId = '93125e08-aea8-4622-9a79-2bf44db6b6d7';
  const productId = '7d0c9a1e-5b2f-4c3d-9e8f-1a2b3c4d5e6f';
  const serviceOrderId = '8c4d3a8c-2d24-4a8e-8b1e-2b0e5ad7d101';
  const now = new Date('2026-09-22T10:00:00.000Z');
  const prisma = {
    $queryRaw: jest.fn(),
    $transaction: jest.fn(),
    inventoryProduct: { findFirst: jest.fn(), update: jest.fn() },
    inventoryMovement: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    serviceOrder: { findFirst: jest.fn() },
    membership: { findFirst: jest.fn() },
  };
  const service = new InventoryMovementsService(prisma as never);

  const lockedProduct = (currentStock: string, isActive = true) => [
    {
      id: productId,
      currentStock: new Prisma.Decimal(currentStock),
      isActive,
    },
  ];

  const movementRow = (overrides: Record<string, unknown> = {}) => ({
    id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
    workshopId: context.workshopId,
    productId,
    serviceOrderId: null,
    createdById: actingUserId,
    createdBy: { userId: actingUserId, displayName: 'Iris Inventory' },
    type: InventoryMovementType.INBOUND,
    quantity: new Prisma.Decimal('3.000'),
    previousStock: new Prisma.Decimal('10.000'),
    newStock: new Prisma.Decimal('13.000'),
    notes: null,
    createdAt: now,
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(
      (value: unknown[] | ((tx: typeof prisma) => unknown)) =>
        Array.isArray(value) ? Promise.all(value) : value(prisma),
    );
    prisma.membership.findFirst.mockResolvedValue({ userId: actingUserId });
    prisma.inventoryMovement.create.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(movementRow(data)),
    );
  });

  const lockCall = () =>
    prisma.$queryRaw.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
  const lockSql = () => lockCall()[0].join('?');

  describe('create', () => {
    it('locks the tenant-scoped product row before writing an INBOUND movement', async () => {
      prisma.$queryRaw.mockResolvedValue(lockedProduct('10'));

      await expect(
        service.create(context, productId, {
          type: InventoryMovementType.INBOUND,
          quantity: 3,
          notes: '  Supplier delivery  ',
        }),
      ).resolves.toEqual({
        id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
        productId,
        serviceOrderId: null,
        type: InventoryMovementType.INBOUND,
        quantity: 3,
        previousStock: 10,
        newStock: 13,
        notes: 'Supplier delivery',
        createdBy: { userId: actingUserId, displayName: 'Iris Inventory' },
        createdAt: now,
      });

      expect(lockSql()).toContain('FROM "inventory_products"');
      expect(lockSql()).toContain('"workshop_id" = ?::uuid');
      expect(lockSql()).toContain('FOR UPDATE');
      expect(lockCall().slice(1)).toEqual([productId, context.workshopId]);
      expect(prisma.inventoryProduct.update).toHaveBeenCalledWith({
        where: { id: productId },
        data: { currentStock: new Prisma.Decimal(13) },
      });
      expect(prisma.inventoryMovement.create).toHaveBeenCalledWith({
        data: {
          workshopId: context.workshopId,
          productId,
          serviceOrderId: null,
          createdById: actingUserId,
          type: InventoryMovementType.INBOUND,
          quantity: new Prisma.Decimal(3),
          previousStock: new Prisma.Decimal(10),
          newStock: new Prisma.Decimal(13),
          notes: 'Supplier delivery',
        },
        include: { createdBy: { select: { userId: true, displayName: true } } },
      });
    });

    it('adds RETURN quantities back to stock', async () => {
      prisma.$queryRaw.mockResolvedValue(lockedProduct('1.5'));

      await service.create(context, productId, {
        type: InventoryMovementType.RETURN,
        quantity: 0.25,
      });

      expect(prisma.inventoryProduct.update).toHaveBeenCalledWith({
        where: { id: productId },
        data: { currentStock: new Prisma.Decimal('1.75') },
      });
    });

    it('subtracts OUTBOUND quantities and keeps the service order association', async () => {
      prisma.$queryRaw.mockResolvedValue(lockedProduct('10'));
      prisma.serviceOrder.findFirst.mockResolvedValue({ id: serviceOrderId });

      await service.create(context, productId, {
        type: InventoryMovementType.OUTBOUND,
        quantity: 4,
        serviceOrderId,
      });

      expect(prisma.serviceOrder.findFirst).toHaveBeenCalledWith({
        where: { id: serviceOrderId, workshopId: context.workshopId },
        select: { id: true },
      });
      expect(prisma.inventoryMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            serviceOrderId,
            type: InventoryMovementType.OUTBOUND,
            quantity: new Prisma.Decimal(4),
            previousStock: new Prisma.Decimal(10),
            newStock: new Prisma.Decimal(6),
          }) as unknown,
        }),
      );
    });

    it('allows an OUTBOUND movement that consumes exactly the available stock', async () => {
      prisma.$queryRaw.mockResolvedValue(lockedProduct('4'));

      await service.create(context, productId, {
        type: InventoryMovementType.OUTBOUND,
        quantity: 4,
      });

      expect(prisma.inventoryProduct.update).toHaveBeenCalledWith({
        where: { id: productId },
        data: { currentStock: new Prisma.Decimal(0) },
      });
    });

    it('refuses an OUTBOUND movement that would make stock negative', async () => {
      prisma.$queryRaw.mockResolvedValue(lockedProduct('2'));

      await expect(
        service.create(context, productId, {
          type: InventoryMovementType.OUTBOUND,
          quantity: 2.5,
        }),
      ).rejects.toEqual(
        new ConflictException(
          'Insufficient stock: 2 available, 2.5 requested. Stock cannot become negative.',
        ),
      );
      expect(prisma.inventoryProduct.update).not.toHaveBeenCalled();
      expect(prisma.inventoryMovement.create).not.toHaveBeenCalled();
    });

    it('rejects a service order from another workshop with not found', async () => {
      prisma.$queryRaw.mockResolvedValue(lockedProduct('10'));
      prisma.serviceOrder.findFirst.mockResolvedValue(null);

      await expect(
        service.create(context, productId, {
          type: InventoryMovementType.OUTBOUND,
          quantity: 1,
          serviceOrderId,
        }),
      ).rejects.toEqual(new NotFoundException('Service order not found.'));
      expect(prisma.inventoryProduct.update).not.toHaveBeenCalled();
    });

    it('records an ADJUSTMENT from a physical count as the absolute difference', async () => {
      prisma.$queryRaw.mockResolvedValue(lockedProduct('10'));

      await service.create(context, productId, {
        type: InventoryMovementType.ADJUSTMENT,
        countedStock: 7.5,
      });

      expect(prisma.inventoryProduct.update).toHaveBeenCalledWith({
        where: { id: productId },
        data: { currentStock: new Prisma.Decimal(7.5) },
      });
      expect(prisma.inventoryMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: InventoryMovementType.ADJUSTMENT,
            quantity: new Prisma.Decimal('2.5'),
            previousStock: new Prisma.Decimal(10),
            newStock: new Prisma.Decimal(7.5),
          }) as unknown,
        }),
      );
    });

    it('records an upward ADJUSTMENT with a positive quantity', async () => {
      prisma.$queryRaw.mockResolvedValue(lockedProduct('0'));

      await service.create(context, productId, {
        type: InventoryMovementType.ADJUSTMENT,
        countedStock: 4,
      });

      expect(prisma.inventoryMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            quantity: new Prisma.Decimal(4),
            previousStock: new Prisma.Decimal(0),
            newStock: new Prisma.Decimal(4),
          }) as unknown,
        }),
      );
    });

    it('rejects an ADJUSTMENT that matches the current stock', async () => {
      prisma.$queryRaw.mockResolvedValue(lockedProduct('7.000'));

      await expect(
        service.create(context, productId, {
          type: InventoryMovementType.ADJUSTMENT,
          countedStock: 7,
        }),
      ).rejects.toEqual(
        new BadRequestException(
          'The counted stock matches the current stock; no adjustment is needed.',
        ),
      );
      expect(prisma.inventoryMovement.create).not.toHaveBeenCalled();
    });

    it('refuses movements on inactive products', async () => {
      prisma.$queryRaw.mockResolvedValue(lockedProduct('10', false));

      await expect(
        service.create(context, productId, {
          type: InventoryMovementType.INBOUND,
          quantity: 1,
        }),
      ).rejects.toEqual(
        new ConflictException(
          'Inactive inventory products cannot receive stock movements.',
        ),
      );
      expect(prisma.inventoryProduct.update).not.toHaveBeenCalled();
    });

    it('returns not found when the product is not in the workshop', async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      await expect(
        service.create(context, productId, {
          type: InventoryMovementType.INBOUND,
          quantity: 1,
        }),
      ).rejects.toEqual(new NotFoundException('Inventory product not found.'));
    });

    it.each([InventoryMovementType.RESERVATION, InventoryMovementType.RELEASE])(
      'rejects server-only %s movements',
      async (type) => {
        await expect(
          service.create(context, productId, {
            type: type as never,
            quantity: 1,
          }),
        ).rejects.toBeInstanceOf(BadRequestException);
        expect(prisma.$transaction).not.toHaveBeenCalled();
      },
    );

    it.each([
      [
        'a quantity-based movement without quantity',
        { type: InventoryMovementType.INBOUND },
      ],
      [
        'a quantity-based movement with countedStock',
        { type: InventoryMovementType.OUTBOUND, quantity: 1, countedStock: 2 },
      ],
      [
        'an ADJUSTMENT without countedStock',
        { type: InventoryMovementType.ADJUSTMENT },
      ],
      [
        'an ADJUSTMENT with quantity',
        {
          type: InventoryMovementType.ADJUSTMENT,
          countedStock: 1,
          quantity: 1,
        },
      ],
      [
        'a service order on an INBOUND movement',
        { type: InventoryMovementType.INBOUND, quantity: 1, serviceOrderId },
      ],
      [
        'a service order on an ADJUSTMENT',
        {
          type: InventoryMovementType.ADJUSTMENT,
          countedStock: 1,
          serviceOrderId,
        },
      ],
    ])('rejects %s before touching the database', async (_label, dto) => {
      await expect(
        service.create(context, productId, dto as never),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('list', () => {
    it('lists movements newest first for a workshop-scoped product', async () => {
      prisma.inventoryProduct.findFirst.mockResolvedValue({ id: productId });
      prisma.inventoryMovement.findMany.mockResolvedValue([movementRow()]);
      prisma.inventoryMovement.count.mockResolvedValue(1);

      await expect(
        service.list(context, productId, {
          type: InventoryMovementType.INBOUND,
          page: 1,
          limit: 20,
        }),
      ).resolves.toMatchObject({
        items: [{ quantity: 3, previousStock: 10, newStock: 13 }],
        total: 1,
        totalPages: 1,
      });

      expect(prisma.inventoryProduct.findFirst).toHaveBeenCalledWith({
        where: { id: productId, workshopId: context.workshopId },
        select: { id: true },
      });
      expect(prisma.inventoryMovement.findMany).toHaveBeenCalledWith({
        where: {
          workshopId: context.workshopId,
          productId,
          type: InventoryMovementType.INBOUND,
        },
        include: { createdBy: { select: { userId: true, displayName: true } } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: 0,
        take: 20,
      });
    });

    it('returns not found for a product from another workshop', async () => {
      prisma.inventoryProduct.findFirst.mockResolvedValue(null);

      await expect(service.list(context, productId, {})).rejects.toEqual(
        new NotFoundException('Inventory product not found.'),
      );
      expect(prisma.inventoryMovement.findMany).not.toHaveBeenCalled();
    });
  });
});
