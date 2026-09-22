import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  InventoryMovementType,
  Prisma,
  ProductUnit,
  UserRole,
} from '@prisma/client';
import { InventoryProductsService } from './inventory-products.service';

describe('InventoryProductsService', () => {
  const context = {
    workshopId: 'e79033dc-7d16-421f-ae1a-d216f9a306d7',
    membershipId: '6650e2ef-c46a-4fe2-875e-4af7c576e12d',
    role: UserRole.INVENTORY_MANAGER,
  };
  const actingUserId = '93125e08-aea8-4622-9a79-2bf44db6b6d7';
  const categoryId = '4b6f2e0a-1c3d-4e5f-8a9b-0c1d2e3f4a5b';
  const now = new Date('2026-09-22T10:00:00.000Z');
  const product = {
    id: '7d0c9a1e-5b2f-4c3d-9e8f-1a2b3c4d5e6f',
    workshopId: context.workshopId,
    categoryId,
    category: { id: categoryId, name: 'Brakes', isActive: true },
    name: 'Brake pads',
    sku: 'BP-001',
    brand: 'Brembo',
    description: null,
    unit: ProductUnit.UNIT,
    costPrice: new Prisma.Decimal('30.50'),
    salePrice: new Prisma.Decimal('45.00'),
    currentStock: new Prisma.Decimal('2.000'),
    minimumStock: new Prisma.Decimal('5.000'),
    location: 'A-1',
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };
  const minimumStockField = { name: 'minimumStock', modelName: 'Product' };
  const prisma = {
    inventoryProduct: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      fields: { minimumStock: minimumStockField },
    },
    inventoryCategory: { findFirst: jest.fn() },
    inventoryMovement: { create: jest.fn() },
    membership: { findFirst: jest.fn() },
    $transaction: jest.fn(),
  };
  const service = new InventoryProductsService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(
      (value: unknown[] | ((tx: typeof prisma) => unknown)) =>
        Array.isArray(value) ? Promise.all(value) : value(prisma),
    );
    prisma.membership.findFirst.mockResolvedValue({ userId: actingUserId });
    prisma.inventoryCategory.findFirst.mockResolvedValue({
      id: categoryId,
      isActive: true,
    });
  });

  it('serializes decimal values as numbers and flags low stock', async () => {
    prisma.inventoryProduct.findFirst.mockResolvedValue(product);

    await expect(service.findOne(context, product.id)).resolves.toEqual({
      id: product.id,
      name: 'Brake pads',
      sku: 'BP-001',
      brand: 'Brembo',
      description: null,
      unit: ProductUnit.UNIT,
      costPrice: 30.5,
      salePrice: 45,
      currentStock: 2,
      minimumStock: 5,
      isLowStock: true,
      location: 'A-1',
      isActive: true,
      category: { id: categoryId, name: 'Brakes', isActive: true },
      createdAt: now,
      updatedAt: now,
    });
    expect(prisma.inventoryProduct.findFirst).toHaveBeenCalledWith({
      where: { id: product.id, workshopId: context.workshopId },
      include: {
        category: { select: { id: true, name: true, isActive: true } },
      },
    });
  });

  it('never exposes a product from another workshop', async () => {
    prisma.inventoryProduct.findFirst.mockResolvedValue(null);

    await expect(service.findOne(context, product.id)).rejects.toEqual(
      new NotFoundException('Inventory product not found.'),
    );
  });

  it('creates a product without a movement when there is no initial stock', async () => {
    prisma.inventoryProduct.create.mockResolvedValue({
      ...product,
      currentStock: new Prisma.Decimal(0),
    });

    await service.create(context, {
      name: ' Brake pads ',
      sku: ' BP-001 ',
      unit: ProductUnit.UNIT,
      costPrice: 30.5,
      categoryId,
    });

    expect(prisma.inventoryProduct.create).toHaveBeenCalledWith({
      data: {
        workshopId: context.workshopId,
        categoryId,
        name: 'Brake pads',
        sku: 'BP-001',
        brand: null,
        description: null,
        unit: ProductUnit.UNIT,
        costPrice: new Prisma.Decimal(30.5),
        salePrice: null,
        minimumStock: null,
        location: null,
        currentStock: new Prisma.Decimal(0),
      },
      include: {
        category: { select: { id: true, name: true, isActive: true } },
      },
    });
    expect(prisma.inventoryMovement.create).not.toHaveBeenCalled();
  });

  it('records initial stock as an INBOUND movement in the same transaction', async () => {
    prisma.inventoryProduct.create.mockResolvedValue({
      ...product,
      currentStock: new Prisma.Decimal('12.5'),
    });

    await expect(
      service.create(context, {
        name: 'Brake pads',
        unit: ProductUnit.UNIT,
        initialStock: 12.5,
      }),
    ).resolves.toMatchObject({ currentStock: 12.5 });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.inventoryProduct.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          currentStock: new Prisma.Decimal(12.5),
        }) as unknown,
      }),
    );
    expect(prisma.inventoryMovement.create).toHaveBeenCalledWith({
      data: {
        workshopId: context.workshopId,
        productId: product.id,
        createdById: actingUserId,
        type: InventoryMovementType.INBOUND,
        quantity: new Prisma.Decimal(12.5),
        previousStock: new Prisma.Decimal(0),
        newStock: new Prisma.Decimal(12.5),
        notes: 'Initial stock.',
      },
    });
  });

  it('rejects a category from another workshop with not found', async () => {
    prisma.inventoryCategory.findFirst.mockResolvedValue(null);

    await expect(
      service.create(context, {
        name: 'Brake pads',
        unit: ProductUnit.UNIT,
        categoryId,
      }),
    ).rejects.toEqual(new NotFoundException('Inventory category not found.'));
    expect(prisma.inventoryCategory.findFirst).toHaveBeenCalledWith({
      where: { id: categoryId, workshopId: context.workshopId },
      select: { id: true, isActive: true },
    });
    expect(prisma.inventoryProduct.create).not.toHaveBeenCalled();
  });

  it('rejects assigning an inactive category', async () => {
    prisma.inventoryCategory.findFirst.mockResolvedValue({
      id: categoryId,
      isActive: false,
    });

    await expect(
      service.create(context, {
        name: 'Brake pads',
        unit: ProductUnit.UNIT,
        categoryId,
      }),
    ).rejects.toEqual(
      new ConflictException(
        'Inactive inventory categories cannot be assigned to products.',
      ),
    );
  });

  it('maps a duplicate SKU to conflict', async () => {
    prisma.inventoryProduct.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    await expect(
      service.create(context, {
        name: 'Brake pads',
        sku: 'BP-001',
        unit: ProductUnit.UNIT,
      }),
    ).rejects.toEqual(
      new ConflictException(
        'An inventory product with this SKU already exists in the workshop.',
      ),
    );
  });

  it('builds search, category, active, low-stock, and out-of-stock filters', async () => {
    prisma.inventoryProduct.findMany.mockResolvedValue([product]);
    prisma.inventoryProduct.count.mockResolvedValue(1);

    await expect(
      service.list(context, {
        search: ' brem ',
        categoryId,
        isActive: true,
        lowStock: true,
        outOfStock: true,
        page: 1,
        limit: 10,
      }),
    ).resolves.toMatchObject({ total: 1, totalPages: 1 });

    expect(prisma.inventoryProduct.findMany).toHaveBeenCalledWith({
      where: {
        workshopId: context.workshopId,
        categoryId,
        isActive: true,
        OR: [
          { name: { contains: 'brem', mode: 'insensitive' } },
          { sku: { contains: 'brem', mode: 'insensitive' } },
          { brand: { contains: 'brem', mode: 'insensitive' } },
        ],
        AND: [
          { minimumStock: { not: null } },
          { currentStock: { lte: minimumStockField } },
          { currentStock: { lte: 0 } },
        ],
      },
      include: {
        category: { select: { id: true, name: true, isActive: true } },
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      skip: 0,
      take: 10,
    });
  });

  it('ignores stock filters that are not explicitly true', async () => {
    prisma.inventoryProduct.findMany.mockResolvedValue([]);
    prisma.inventoryProduct.count.mockResolvedValue(0);

    await service.list(context, { lowStock: false, outOfStock: false });

    expect(prisma.inventoryProduct.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { workshopId: context.workshopId } }),
    );
  });

  it('updates editable fields after a workshop-scoped lookup', async () => {
    prisma.inventoryProduct.findFirst.mockResolvedValue({
      id: product.id,
      categoryId,
    });
    prisma.inventoryProduct.update.mockResolvedValue(product);

    await service.update(context, product.id, {
      salePrice: 50,
      minimumStock: null,
      sku: ' ',
      categoryId: null,
      isActive: false,
    });

    expect(prisma.inventoryProduct.findFirst).toHaveBeenCalledWith({
      where: { id: product.id, workshopId: context.workshopId },
      select: { id: true, categoryId: true },
    });
    expect(prisma.inventoryProduct.update).toHaveBeenCalledWith({
      where: { id: product.id },
      data: {
        salePrice: new Prisma.Decimal(50),
        minimumStock: null,
        sku: null,
        categoryId: null,
        isActive: false,
      },
      include: {
        category: { select: { id: true, name: true, isActive: true } },
      },
    });
  });

  it('validates a newly assigned category on update', async () => {
    const otherCategoryId = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
    prisma.inventoryProduct.findFirst.mockResolvedValue({
      id: product.id,
      categoryId,
    });
    prisma.inventoryCategory.findFirst.mockResolvedValue(null);

    await expect(
      service.update(context, product.id, { categoryId: otherCategoryId }),
    ).rejects.toEqual(new NotFoundException('Inventory category not found.'));
    expect(prisma.inventoryProduct.update).not.toHaveBeenCalled();
  });

  it('never updates a product from another workshop', async () => {
    prisma.inventoryProduct.findFirst.mockResolvedValue(null);

    await expect(
      service.update(context, product.id, { name: 'Other' }),
    ).rejects.toEqual(new NotFoundException('Inventory product not found.'));
    expect(prisma.inventoryProduct.update).not.toHaveBeenCalled();
  });

  it('rejects explicit nulls for required product fields', async () => {
    await expect(
      service.update(context, product.id, { unit: null as never }),
    ).rejects.toMatchObject({ status: 400 });
    expect(prisma.inventoryProduct.update).not.toHaveBeenCalled();
  });
});
