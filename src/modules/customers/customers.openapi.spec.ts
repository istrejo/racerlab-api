import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { createSwaggerDocumentBuilder } from '../../config/swagger.config';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';

type OpenApiSchema = {
  properties?: Record<string, unknown>;
  required?: string[];
};

describe('Customers OpenAPI contract', () => {
  let app: INestApplication;
  let document: OpenAPIObject;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CustomersController],
      providers: [
        {
          provide: CustomersService,
          useValue: {
            create: jest.fn(),
            list: jest.fn(),
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

  it('documents all five protected customer operations', () => {
    expect(document.paths['/customers']?.get?.security).toEqual([
      { bearer: [] },
    ]);
    expect(document.paths['/customers']?.post?.security).toEqual([
      { bearer: [] },
    ]);
    expect(document.paths['/customers/{id}']?.get?.security).toEqual([
      { bearer: [] },
    ]);
    expect(document.paths['/customers/{id}']?.patch?.security).toEqual([
      { bearer: [] },
    ]);
    expect(document.paths['/customers/{id}']?.delete?.security).toEqual([
      { bearer: [] },
    ]);
  });

  it('publishes customer fields, relationship counts, and pagination metadata', () => {
    const customer = document.components?.schemas?.CustomerResponseDto as
      OpenApiSchema | undefined;
    const page = document.components?.schemas?.CustomerPageResponseDto as
      OpenApiSchema | undefined;

    expect(Object.keys(customer?.properties ?? {})).toEqual([
      'id',
      'fullName',
      'phone',
      'whatsapp',
      'email',
      'document',
      'address',
      'notes',
      'vehicleCount',
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

  it('documents search, page, and bounded limit query parameters', () => {
    const parameters = document.paths['/customers']?.get?.parameters ?? [];
    expect(
      parameters.map((parameter) => 'name' in parameter && parameter.name),
    ).toEqual(['search', 'page', 'limit']);
  });
});
