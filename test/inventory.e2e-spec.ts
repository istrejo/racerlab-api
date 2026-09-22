import { ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  InventoryMovementType,
  Prisma,
  ProductUnit,
  UserRole,
} from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import type { AuthenticatedUser } from '../src/common/auth/authenticated-user';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { RolesGuard } from '../src/common/guards/roles.guard';
import { WorkshopContextGuard } from '../src/common/guards/workshop-context.guard';
import { configureApp } from '../src/main';
import { InventoryCategoriesController } from '../src/modules/inventory/inventory-categories.controller';
import { InventoryCategoriesService } from '../src/modules/inventory/inventory-categories.service';
import { InventoryMovementsController } from '../src/modules/inventory/inventory-movements.controller';
import { InventoryMovementsService } from '../src/modules/inventory/inventory-movements.service';
import { InventoryProductsController } from '../src/modules/inventory/inventory-products.controller';
import { InventoryProductsService } from '../src/modules/inventory/inventory-products.service';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Inventory API (e2e)', () => {
  const workshopId = 'e79033dc-7d16-421f-ae1a-d216f9a306d7';
  const membershipId = '6650e2ef-c46a-4fe2-875e-4af7c576e12d';
  const userId = '93125e08-aea8-4622-9a79-2bf44db6b6d7';
  const categoryId = '4b6f2e0a-1c3d-4e5f-8a9b-0c1d2e3f4a5b';
  const productId = '7d0c9a1e-5b2f-4c3d-9e8f-1a2b3c4d5e6f';
  const serviceOrderId = '8c4d3a8c-2d24-4a8e-8b1e-2b0e5ad7d101';
  const foreignId = '1f4ad0f4-0d26-4a2c-9f6b-2c0a2d5f9e22';
  const timestamp = new Date('2026-09-22T10:00:00.000Z');

  const categoryRow = {
    id: categoryId,
    workshopId,
    name: 'Brakes',
    description: null,
    isActive: true,
    createdAt: timestamp,
    updatedAt: timestamp,
    _count: { products: 0 },
  };
  const productRow = (currentStock: string) => ({
    id: productId,
    workshopId,
    categoryId,
    category: { id: categoryId, name: 'Brakes', isActive: true },
    name: 'Brake pads',
    sku: 'BP-001',
    brand: null,
    description: null,
    unit: ProductUnit.UNIT,
    costPrice: null,
    salePrice: new Prisma.Decimal('45.00'),
    currentStock: new Prisma.Decimal(currentStock),
    minimumStock: null,
    location: null,
    isActive: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  const movementRow = (data: Record<string, unknown>) => ({
    id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
    serviceOrderId: null,
    notes: null,
    ...data,
    createdBy: { userId, displayName: 'Iris Inventory' },
    createdAt: timestamp,
  });

  const prisma = {
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
    membership: { findFirst: jest.fn() },
    serviceOrder: { findFirst: jest.fn() },
    inventoryCategory: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    inventoryProduct: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      fields: { minimumStock: { name: 'minimumStock' } },
    },
    inventoryMovement: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };

  let app: INestApplication<App>;
  let currentRole: UserRole = UserRole.INVENTORY_MANAGER;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [
        InventoryCategoriesController,
        InventoryProductsController,
        InventoryMovementsController,
      ],
      providers: [
        WorkshopContextGuard,
        RolesGuard,
        InventoryCategoriesService,
        InventoryProductsService,
        InventoryMovementsService,
        { provide: PrismaService, useValue: prisma },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          context
            .switchToHttp()
            .getRequest<{ user?: AuthenticatedUser }>().user = {
            id: userId,
            email: 'inventory@example.com',
            isActive: true,
            mustChangePassword: false,
            sessionId: '66e37e48-b2df-4de4-b726-56c958403c8e',
            workshopId,
            membershipId,
            role: currentRole,
          };
          return true;
        },
      })
      .compile();

    app = module.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => app.close());

  beforeEach(() => {
    currentRole = UserRole.INVENTORY_MANAGER;
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(
      (value: unknown[] | ((tx: typeof prisma) => unknown)) =>
        Array.isArray(value) ? Promise.all(value) : value(prisma),
    );
    prisma.membership.findFirst.mockResolvedValue({ userId });
    prisma.inventoryMovement.create.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(movementRow(data)),
    );
  });

  it('runs a category → product with initial stock → consumption journey', async () => {
    prisma.inventoryCategory.create.mockResolvedValue(categoryRow);
    const category = await request(app.getHttpServer())
      .post('/api/inventory/categories')
      .send({ name: ' Brakes ' })
      .expect(201);
    expect(category.body).toMatchObject({ id: categoryId, productCount: 0 });

    prisma.inventoryCategory.findFirst.mockResolvedValue({
      id: categoryId,
      isActive: true,
    });
    prisma.inventoryProduct.create.mockResolvedValue(productRow('10'));
    const product = await request(app.getHttpServer())
      .post('/api/inventory/products')
      .send({
        name: 'Brake pads',
        sku: 'BP-001',
        unit: ProductUnit.UNIT,
        salePrice: 45,
        categoryId,
        initialStock: 10,
      })
      .expect(201);
    expect(product.body).toMatchObject({
      id: productId,
      currentStock: 10,
      salePrice: 45,
      isLowStock: false,
      category: { id: categoryId, name: 'Brakes' },
    });
    expect(prisma.inventoryMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: InventoryMovementType.INBOUND,
        createdById: userId,
        newStock: new Prisma.Decimal(10),
      }) as unknown,
    });

    prisma.$queryRaw.mockResolvedValue([
      { id: productId, currentStock: new Prisma.Decimal('10'), isActive: true },
    ]);
    prisma.serviceOrder.findFirst.mockResolvedValue({ id: serviceOrderId });
    const movement = await request(app.getHttpServer())
      .post(`/api/inventory/products/${productId}/movements`)
      .send({
        type: InventoryMovementType.OUTBOUND,
        quantity: 4,
        serviceOrderId,
        notes: ' Used on order ',
      })
      .expect(201);
    expect(movement.body).toMatchObject({
      type: 'OUTBOUND',
      quantity: 4,
      previousStock: 10,
      newStock: 6,
      serviceOrderId,
      notes: 'Used on order',
      createdBy: { userId },
    });
    expect(prisma.inventoryProduct.update).toHaveBeenCalledWith({
      where: { id: productId },
      data: { currentStock: new Prisma.Decimal(6) },
    });

    prisma.inventoryProduct.findFirst.mockResolvedValue({ id: productId });
    prisma.inventoryMovement.findMany.mockResolvedValue([
      movementRow({
        productId,
        type: InventoryMovementType.OUTBOUND,
        quantity: new Prisma.Decimal(4),
        previousStock: new Prisma.Decimal(10),
        newStock: new Prisma.Decimal(6),
      }),
    ]);
    prisma.inventoryMovement.count.mockResolvedValue(1);
    const history = await request(app.getHttpServer())
      .get(`/api/inventory/products/${productId}/movements?type=OUTBOUND`)
      .expect(200);
    expect(history.body).toMatchObject({
      items: [{ type: 'OUTBOUND', quantity: 4 }],
      total: 1,
    });
  });

  it('parses list filters for products', async () => {
    prisma.inventoryProduct.findMany.mockResolvedValue([]);
    prisma.inventoryProduct.count.mockResolvedValue(0);

    await request(app.getHttpServer())
      .get(
        `/api/inventory/products?search=%20pads%20&categoryId=${categoryId}&isActive=true&lowStock=true&outOfStock=false&page=2&limit=5`,
      )
      .expect(200)
      .expect({ items: [], page: 2, limit: 5, total: 0, totalPages: 0 });

    expect(prisma.inventoryProduct.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          workshopId,
          categoryId,
          isActive: true,
          AND: [
            { minimumStock: { not: null } },
            {
              currentStock: {
                lte: prisma.inventoryProduct.fields.minimumStock,
              },
            },
          ],
        }) as unknown,
        skip: 5,
        take: 5,
      }),
    );
  });

  describe('RBAC', () => {
    beforeEach(() => {
      prisma.inventoryProduct.findMany.mockResolvedValue([]);
      prisma.inventoryProduct.count.mockResolvedValue(0);
      prisma.inventoryCategory.findMany.mockResolvedValue([]);
      prisma.inventoryCategory.count.mockResolvedValue(0);
    });

    it.each([UserRole.TECHNICIAN, UserRole.ADVISOR])(
      'lets %s read but not write inventory',
      async (role) => {
        currentRole = role;
        await request(app.getHttpServer())
          .get('/api/inventory/products')
          .expect(200);
        await request(app.getHttpServer())
          .get('/api/inventory/categories')
          .expect(200);
        await request(app.getHttpServer())
          .post('/api/inventory/categories')
          .send({ name: 'Oils' })
          .expect(403);
        await request(app.getHttpServer())
          .post('/api/inventory/products')
          .send({ name: 'Oil', unit: ProductUnit.LITER })
          .expect(403);
        await request(app.getHttpServer())
          .post(`/api/inventory/products/${productId}/movements`)
          .send({ type: InventoryMovementType.INBOUND, quantity: 1 })
          .expect(403);
        expect(prisma.$transaction).not.toHaveBeenCalledWith(
          expect.any(Function),
        );
      },
    );

    it.each([
      UserRole.OWNER,
      UserRole.ADMIN,
      UserRole.MANAGER,
      UserRole.INVENTORY_MANAGER,
    ])('lets %s write inventory', async (role) => {
      currentRole = role;
      prisma.inventoryCategory.create.mockResolvedValue(categoryRow);
      await request(app.getHttpServer())
        .post('/api/inventory/categories')
        .send({ name: 'Brakes' })
        .expect(201);
    });
  });

  describe('validation', () => {
    it('rejects invalid pagination and filters', async () => {
      await request(app.getHttpServer())
        .get('/api/inventory/products?page=0&limit=101')
        .expect(400);
      await request(app.getHttpServer())
        .get('/api/inventory/products?lowStock=maybe&categoryId=nope')
        .expect(400);
      await request(app.getHttpServer())
        .get(`/api/inventory/products/${productId}/movements?type=UNKNOWN`)
        .expect(400);
      await request(app.getHttpServer())
        .get('/api/inventory/products/not-a-uuid')
        .expect(400);
    });

    it('never accepts currentStock or unknown fields on product writes', async () => {
      await request(app.getHttpServer())
        .post('/api/inventory/products')
        .send({ name: 'Oil', unit: ProductUnit.LITER, currentStock: 5 })
        .expect(400);
      await request(app.getHttpServer())
        .patch(`/api/inventory/products/${productId}`)
        .send({ currentStock: 5 })
        .expect(400);
      await request(app.getHttpServer())
        .patch(`/api/inventory/products/${productId}`)
        .send({ initialStock: 5 })
        .expect(400);
      await request(app.getHttpServer())
        .post('/api/inventory/products')
        .send({ name: 'Oil', unit: 'BARREL', initialStock: -1 })
        .expect(400);
      expect(prisma.inventoryProduct.create).not.toHaveBeenCalled();
      expect(prisma.inventoryProduct.update).not.toHaveBeenCalled();
    });

    it('rejects server-only and malformed movements', async () => {
      const url = `/api/inventory/products/${productId}/movements`;
      for (const body of [
        { type: InventoryMovementType.RESERVATION, quantity: 1 },
        { type: InventoryMovementType.RELEASE, quantity: 1 },
        { type: InventoryMovementType.INBOUND, quantity: 0 },
        { type: InventoryMovementType.OUTBOUND, quantity: -2 },
        { type: InventoryMovementType.INBOUND, quantity: 1.0001 },
        { type: InventoryMovementType.ADJUSTMENT, countedStock: -1 },
        { type: InventoryMovementType.ADJUSTMENT },
        {
          type: InventoryMovementType.INBOUND,
          quantity: 1,
          notes: 'x'.repeat(501),
        },
      ]) {
        await request(app.getHttpServer()).post(url).send(body).expect(400);
      }
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });
  });

  describe('tenant isolation and stock rules', () => {
    it('returns 404 for products and categories of another workshop', async () => {
      prisma.inventoryProduct.findFirst.mockResolvedValue(null);
      prisma.inventoryCategory.findFirst.mockResolvedValue(null);
      prisma.$queryRaw.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get(`/api/inventory/products/${foreignId}`)
        .expect(404);
      await request(app.getHttpServer())
        .patch(`/api/inventory/products/${foreignId}`)
        .send({ name: 'Hijack' })
        .expect(404);
      await request(app.getHttpServer())
        .patch(`/api/inventory/categories/${foreignId}`)
        .send({ isActive: false })
        .expect(404);
      await request(app.getHttpServer())
        .get(`/api/inventory/products/${foreignId}/movements`)
        .expect(404);
      await request(app.getHttpServer())
        .post(`/api/inventory/products/${foreignId}/movements`)
        .send({ type: InventoryMovementType.INBOUND, quantity: 1 })
        .expect(404);
      await request(app.getHttpServer())
        .post('/api/inventory/products')
        .send({ name: 'Oil', unit: ProductUnit.LITER, categoryId: foreignId })
        .expect(404);
      expect(prisma.inventoryProduct.update).not.toHaveBeenCalled();
      expect(prisma.inventoryCategory.update).not.toHaveBeenCalled();
    });

    it('returns 404 when consumption references a foreign service order', async () => {
      prisma.$queryRaw.mockResolvedValue([
        { id: productId, currentStock: new Prisma.Decimal(5), isActive: true },
      ]);
      prisma.serviceOrder.findFirst.mockResolvedValue(null);

      await request(app.getHttpServer())
        .post(`/api/inventory/products/${productId}/movements`)
        .send({
          type: InventoryMovementType.OUTBOUND,
          quantity: 1,
          serviceOrderId: foreignId,
        })
        .expect(404);
    });

    it('returns 409 when stock would become negative', async () => {
      prisma.$queryRaw.mockResolvedValue([
        { id: productId, currentStock: new Prisma.Decimal(1), isActive: true },
      ]);

      const response = await request(app.getHttpServer())
        .post(`/api/inventory/products/${productId}/movements`)
        .send({ type: InventoryMovementType.OUTBOUND, quantity: 2 })
        .expect(409);
      expect((response.body as { message: string }).message).toContain(
        'Stock cannot become negative',
      );
      expect(prisma.inventoryMovement.create).not.toHaveBeenCalled();
    });

    it('returns 409 for duplicate SKUs', async () => {
      prisma.inventoryProduct.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

      await request(app.getHttpServer())
        .post('/api/inventory/products')
        .send({ name: 'Oil', sku: 'OIL-1', unit: ProductUnit.LITER })
        .expect(409);
    });
  });
});
