import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { InventoryCategoriesService } from './inventory-categories.service';

describe('InventoryCategoriesService', () => {
  const context = {
    workshopId: 'e79033dc-7d16-421f-ae1a-d216f9a306d7',
    membershipId: '6650e2ef-c46a-4fe2-875e-4af7c576e12d',
    role: UserRole.INVENTORY_MANAGER,
  };
  const now = new Date('2026-09-22T10:00:00.000Z');
  const category = {
    id: '4b6f2e0a-1c3d-4e5f-8a9b-0c1d2e3f4a5b',
    workshopId: context.workshopId,
    name: 'Brakes',
    description: null,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    _count: { products: 3 },
  };
  const prisma = {
    inventoryCategory: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const service = new InventoryCategoriesService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(
      (value: unknown[] | ((tx: typeof prisma) => unknown)) =>
        Array.isArray(value) ? Promise.all(value) : value(prisma),
    );
  });

  it('creates a workshop-scoped category with trimmed values', async () => {
    prisma.inventoryCategory.create.mockResolvedValue(category);

    await expect(
      service.create(context, { name: ' Brakes ', description: ' ' }),
    ).resolves.toEqual({
      id: category.id,
      name: 'Brakes',
      description: null,
      isActive: true,
      productCount: 3,
      createdAt: now,
      updatedAt: now,
    });

    expect(prisma.inventoryCategory.create).toHaveBeenCalledWith({
      data: {
        workshopId: context.workshopId,
        name: 'Brakes',
        description: null,
      },
      include: { _count: { select: { products: true } } },
    });
  });

  it('maps a duplicate category name to conflict', async () => {
    prisma.inventoryCategory.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    await expect(service.create(context, { name: 'Brakes' })).rejects.toEqual(
      new ConflictException(
        'An inventory category with this name already exists in the workshop.',
      ),
    );
  });

  it('lists categories with search and active filters inside the workshop', async () => {
    prisma.inventoryCategory.findMany.mockResolvedValue([category]);
    prisma.inventoryCategory.count.mockResolvedValue(21);

    await expect(
      service.list(context, {
        search: ' bra ',
        isActive: true,
        page: 2,
        limit: 20,
      }),
    ).resolves.toMatchObject({ page: 2, limit: 20, total: 21, totalPages: 2 });

    expect(prisma.inventoryCategory.findMany).toHaveBeenCalledWith({
      where: {
        workshopId: context.workshopId,
        isActive: true,
        name: { contains: 'bra', mode: 'insensitive' },
      },
      include: { _count: { select: { products: true } } },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      skip: 20,
      take: 20,
    });
  });

  it('defaults pagination and reports zero pages for an empty list', async () => {
    prisma.inventoryCategory.findMany.mockResolvedValue([]);
    prisma.inventoryCategory.count.mockResolvedValue(0);

    await expect(service.list(context, {})).resolves.toEqual({
      items: [],
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
    });
  });

  it('deactivates a category through a workshop-scoped update', async () => {
    prisma.inventoryCategory.findFirst.mockResolvedValue({ id: category.id });
    prisma.inventoryCategory.update.mockResolvedValue({
      ...category,
      isActive: false,
    });

    await expect(
      service.update(context, category.id, { isActive: false }),
    ).resolves.toMatchObject({ isActive: false });

    expect(prisma.inventoryCategory.findFirst).toHaveBeenCalledWith({
      where: { id: category.id, workshopId: context.workshopId },
      select: { id: true },
    });
    expect(prisma.inventoryCategory.update).toHaveBeenCalledWith({
      where: { id: category.id },
      data: { isActive: false },
      include: { _count: { select: { products: true } } },
    });
  });

  it('never updates a category from another workshop', async () => {
    prisma.inventoryCategory.findFirst.mockResolvedValue(null);

    await expect(
      service.update(context, category.id, { name: 'Other' }),
    ).rejects.toEqual(new NotFoundException('Inventory category not found.'));
    expect(prisma.inventoryCategory.update).not.toHaveBeenCalled();
  });

  it('rejects explicit nulls for required category fields', async () => {
    await expect(
      service.update(context, category.id, { name: null as never }),
    ).rejects.toMatchObject({ status: 400 });
    expect(prisma.inventoryCategory.update).not.toHaveBeenCalled();
  });
});
