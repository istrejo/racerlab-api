import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { createSwaggerDocumentBuilder } from '../../config/swagger.config';
import { ServiceOrdersController } from './service-orders.controller';
import { ServiceOrdersService } from './service-orders.service';

type OpenApiSchema = {
  properties?: Record<string, unknown>;
  required?: string[];
};

describe('ServiceOrders OpenAPI contract', () => {
  let app: INestApplication;
  let document: OpenAPIObject;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ServiceOrdersController],
      providers: [
        {
          provide: ServiceOrdersService,
          useValue: {
            list: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            changeStatus: jest.fn(),
            assignTechnician: jest.fn(),
          },
        },
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();
    document = SwaggerModule.createDocument(app, createSwaggerDocumentBuilder().build());
  });

  afterAll(async () => app.close());

  it('documents all six protected service-order operations', () => {
    const base = '/service-orders';
    expect(document.paths[base]?.get?.security).toEqual([{ bearer: [] }]);
    expect(document.paths[base]?.post?.security).toEqual([{ bearer: [] }]);
    expect(document.paths[`${base}/{id}`]?.get?.security).toEqual([{ bearer: [] }]);
    expect(document.paths[`${base}/{id}`]?.patch?.security).toEqual([{ bearer: [] }]);
    expect(document.paths[`${base}/{id}/status`]?.patch?.security).toEqual([{ bearer: [] }]);
    expect(document.paths[`${base}/{id}/technician`]?.patch?.security).toEqual([{ bearer: [] }]);
  });

  it('publishes service order list fields and pagination metadata', () => {
    const response = document.components?.schemas
      ?.ServiceOrderResponseDto as OpenApiSchema | undefined;
    const page = document.components?.schemas
      ?.ServiceOrderPageResponseDto as OpenApiSchema | undefined;

    const fields = Object.keys(response?.properties ?? {});
    expect(fields).toContain('id');
    expect(fields).toContain('code');
    expect(fields).toContain('status');
    expect(fields).toContain('customer');
    expect(fields).toContain('vehicle');
    expect(fields).toContain('assignedTechnician');
    expect(fields).toContain('diagnosisCount');

    expect(Object.keys(page?.properties ?? {})).toEqual([
      'items',
      'page',
      'limit',
      'total',
      'totalPages',
    ]);
  });

  it('publishes service order detail fields including statusHistory and createdBy', () => {
    const detail = document.components?.schemas
      ?.ServiceOrderDetailResponseDto as OpenApiSchema | undefined;

    const fields = Object.keys(detail?.properties ?? {});
    expect(fields).toContain('statusHistory');
    expect(fields).toContain('createdBy');
  });

  it('documents validation and authentication failures on every operation', () => {
    const base = '/service-orders';
    for (const operation of [
      document.paths[base]?.get,
      document.paths[base]?.post,
      document.paths[`${base}/{id}`]?.get,
      document.paths[`${base}/{id}`]?.patch,
      document.paths[`${base}/{id}/status`]?.patch,
      document.paths[`${base}/{id}/technician`]?.patch,
    ]) {
      expect(operation?.responses).toHaveProperty('400');
      expect(operation?.responses).toHaveProperty('401');
    }
  });

  it('documents filter query parameters on list', () => {
    const parameters = document.paths['/service-orders']?.get?.parameters ?? [];
    const names = parameters.map((p) => 'name' in p && p.name);
    expect(names).toEqual(
      expect.arrayContaining(['search', 'status', 'customerId', 'vehicleId', 'page', 'limit']),
    );
  });
});
