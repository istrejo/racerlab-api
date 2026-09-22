import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { createSwaggerDocumentBuilder } from '../../config/swagger.config';
import { InventoryCategoriesController } from './inventory-categories.controller';
import { InventoryCategoriesService } from './inventory-categories.service';
import { InventoryMovementsController } from './inventory-movements.controller';
import { InventoryMovementsService } from './inventory-movements.service';
import { InventoryProductsController } from './inventory-products.controller';
import { InventoryProductsService } from './inventory-products.service';

type OpenApiSchema = {
  properties?: Record<string, { enum?: string[] } & Record<string, unknown>>;
  required?: string[];
};

describe('Inventory OpenAPI contract', () => {
  let app: INestApplication;
  let document: OpenAPIObject;

  const schema = (name: string) =>
    document.components?.schemas?.[name] as OpenApiSchema | undefined;
  const parameterNames = (path: string) =>
    (document.paths[path]?.get?.parameters ?? []).map(
      (parameter) => 'name' in parameter && parameter.name,
    );

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [
        InventoryCategoriesController,
        InventoryProductsController,
        InventoryMovementsController,
      ],
      providers: [
        { provide: InventoryCategoriesService, useValue: {} },
        { provide: InventoryProductsService, useValue: {} },
        { provide: InventoryMovementsService, useValue: {} },
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();
    document = SwaggerModule.createDocument(
      app,
      createSwaggerDocumentBuilder().build(),
    );
  });

  afterAll(async () => app.close());

  const operations = () => [
    document.paths['/inventory/categories']?.get,
    document.paths['/inventory/categories']?.post,
    document.paths['/inventory/categories/{id}']?.patch,
    document.paths['/inventory/products']?.get,
    document.paths['/inventory/products']?.post,
    document.paths['/inventory/products/{id}']?.get,
    document.paths['/inventory/products/{id}']?.patch,
    document.paths['/inventory/products/{productId}/movements']?.get,
    document.paths['/inventory/products/{productId}/movements']?.post,
  ];

  it('documents every inventory operation as protected with auth and validation failures', () => {
    for (const operation of operations()) {
      expect(operation).toBeDefined();
      expect(operation?.security).toEqual([{ bearer: [] }]);
      expect(operation?.tags).toEqual(['inventory']);
      expect(operation?.responses).toHaveProperty('400');
      expect(operation?.responses).toHaveProperty('401');
      expect(operation?.responses).toHaveProperty('403');
    }
  });

  it('exposes no hard-delete operations', () => {
    expect(
      document.paths['/inventory/categories/{id}']?.delete,
    ).toBeUndefined();
    expect(document.paths['/inventory/products/{id}']?.delete).toBeUndefined();
  });

  it('documents conflicts for duplicates and stock rules', () => {
    expect(
      document.paths['/inventory/categories']?.post?.responses,
    ).toHaveProperty('409');
    expect(
      document.paths['/inventory/products']?.post?.responses,
    ).toHaveProperty('409');
    expect(
      document.paths['/inventory/products/{productId}/movements']?.post
        ?.responses,
    ).toHaveProperty('409');
    expect(
      document.paths['/inventory/products/{productId}/movements']?.post
        ?.responses,
    ).toHaveProperty('404');
  });

  it('documents list filters and pagination', () => {
    expect(parameterNames('/inventory/categories')).toEqual([
      'search',
      'isActive',
      'page',
      'limit',
    ]);
    expect(parameterNames('/inventory/products')).toEqual([
      'search',
      'categoryId',
      'isActive',
      'lowStock',
      'outOfStock',
      'page',
      'limit',
    ]);
    expect(parameterNames('/inventory/products/{productId}/movements')).toEqual(
      ['productId', 'type', 'page', 'limit'],
    );
  });

  it('publishes product fields with numeric decimals and the category summary', () => {
    const product = schema('InventoryProductResponseDto');
    expect(Object.keys(product?.properties ?? {})).toEqual([
      'id',
      'name',
      'sku',
      'brand',
      'description',
      'unit',
      'costPrice',
      'salePrice',
      'currentStock',
      'minimumStock',
      'isLowStock',
      'location',
      'isActive',
      'category',
      'createdAt',
      'updatedAt',
    ]);
    expect(product?.properties?.currentStock).toMatchObject({ type: 'number' });
    expect(product?.properties?.unit?.enum).toEqual([
      'UNIT',
      'LITER',
      'MILLILITER',
      'KILOGRAM',
      'GRAM',
      'METER',
      'CENTIMETER',
      'HOUR',
      'PACKAGE',
    ]);
  });

  it('never makes currentStock writable through product create or update', () => {
    const create = schema('CreateInventoryProductDto');
    const update = schema('UpdateInventoryProductDto');

    expect(create?.properties).not.toHaveProperty('currentStock');
    expect(update?.properties).not.toHaveProperty('currentStock');
    expect(create?.properties).toHaveProperty('initialStock');
    expect(update?.properties).not.toHaveProperty('initialStock');
    expect(create?.required).toEqual(['name', 'unit']);
  });

  it('only offers client-assignable movement types', () => {
    const create = schema('CreateInventoryMovementDto');
    expect(create?.properties?.type?.enum).toEqual([
      'INBOUND',
      'OUTBOUND',
      'RETURN',
      'ADJUSTMENT',
    ]);
    expect(Object.keys(create?.properties ?? {})).toEqual([
      'type',
      'quantity',
      'countedStock',
      'serviceOrderId',
      'notes',
    ]);
  });

  it('publishes movement and page response shapes', () => {
    expect(
      Object.keys(schema('InventoryMovementResponseDto')?.properties ?? {}),
    ).toEqual([
      'id',
      'productId',
      'serviceOrderId',
      'type',
      'quantity',
      'previousStock',
      'newStock',
      'notes',
      'createdBy',
      'createdAt',
    ]);
    for (const page of [
      'InventoryCategoryPageResponseDto',
      'InventoryProductPageResponseDto',
      'InventoryMovementPageResponseDto',
    ]) {
      expect(Object.keys(schema(page)?.properties ?? {})).toEqual([
        'items',
        'page',
        'limit',
        'total',
        'totalPages',
      ]);
    }
    expect(
      Object.keys(schema('InventoryCategoryResponseDto')?.properties ?? {}),
    ).toEqual([
      'id',
      'name',
      'description',
      'isActive',
      'productCount',
      'createdAt',
      'updatedAt',
    ]);
  });
});
