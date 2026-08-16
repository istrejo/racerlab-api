import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { createSwaggerDocumentBuilder } from '../../config/swagger.config';
import { VehiclesOverviewController } from './vehicles-overview.controller';
import { VehiclesController } from './vehicles.controller';
import { VehiclesService } from './vehicles.service';

type OpenApiSchema = {
  properties?: Record<string, unknown>;
  required?: string[];
};

describe('Vehicles OpenAPI contract', () => {
  let app: INestApplication;
  let document: OpenAPIObject;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VehiclesOverviewController, VehiclesController],
      providers: [
        {
          provide: VehiclesService,
          useValue: {
            create: jest.fn(),
            list: jest.fn(),
            listForWorkshop: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
          },
        },
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

  it('documents all five protected vehicle operations', () => {
    const base = '/customers/{customerId}/vehicles';
    expect(document.paths[base]?.get?.security).toEqual([{ bearer: [] }]);
    expect(document.paths[base]?.post?.security).toEqual([{ bearer: [] }]);
    expect(document.paths[`${base}/{id}`]?.get?.security).toEqual([
      { bearer: [] },
    ]);
    expect(document.paths[`${base}/{id}`]?.patch?.security).toEqual([
      { bearer: [] },
    ]);
    expect(document.paths[`${base}/{id}`]?.delete?.security).toEqual([
      { bearer: [] },
    ]);
  });

  it('publishes vehicle fields and pagination metadata', () => {
    const vehicle = document.components?.schemas?.VehicleResponseDto as
      OpenApiSchema | undefined;
    const page = document.components?.schemas?.VehiclePageResponseDto as
      OpenApiSchema | undefined;

    expect(Object.keys(vehicle?.properties ?? {})).toEqual([
      'id',
      'customerId',
      'plate',
      'brand',
      'model',
      'year',
      'color',
      'vin',
      'mileage',
      'vehicleType',
      'notes',
      'serviceOrderCount',
      'createdAt',
      'updatedAt',
    ]);

    expect(Object.keys(page?.properties ?? {})).toEqual([
      'items',
      'page',
      'limit',
      'total',
      'totalPages',
    ]);
  });

  it('documents validation and authentication failures on every operation', () => {
    const base = '/customers/{customerId}/vehicles';
    for (const operation of [
      document.paths[base]?.get,
      document.paths[base]?.post,
      document.paths[`${base}/{id}`]?.get,
      document.paths[`${base}/{id}`]?.patch,
      document.paths[`${base}/{id}`]?.delete,
    ]) {
      expect(operation?.responses).toHaveProperty('400');
      expect(operation?.responses).toHaveProperty('401');
    }
  });

  it('documents the workshop-wide vehicle listing', () => {
    const operation = document.paths['/vehicles']?.get;

    expect(operation?.security).toEqual([{ bearer: [] }]);
    expect(operation?.responses).toHaveProperty('400');
    expect(operation?.responses).toHaveProperty('401');
    expect(operation?.parameters?.map((p) => 'name' in p && p.name)).toEqual(
      expect.arrayContaining(['search', 'page', 'limit']),
    );
  });

  it('publishes the customer summary on workshop-wide vehicles', () => {
    const vehicle = document.components?.schemas
      ?.VehicleWithCustomerResponseDto as OpenApiSchema | undefined;

    expect(Object.keys(vehicle?.properties ?? {})).toEqual(
      expect.arrayContaining(['id', 'plate', 'serviceOrderCount', 'customer']),
    );
  });

  it('documents search, page, and bounded limit query parameters on list', () => {
    const base = '/customers/{customerId}/vehicles';
    const parameters = document.paths[base]?.get?.parameters ?? [];
    expect(parameters.map((p) => 'name' in p && p.name)).toEqual(
      expect.arrayContaining(['customerId', 'search', 'page', 'limit']),
    );
  });
});
