import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { createSwaggerDocumentBuilder } from '../../config/swagger.config';
import { DiagnosesController } from './diagnoses.controller';
import { DiagnosesService } from './diagnoses.service';

type OpenApiSchema = {
  properties?: Record<string, unknown>;
  required?: string[];
};

describe('Diagnoses OpenAPI contract', () => {
  let app: INestApplication;
  let document: OpenAPIObject;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DiagnosesController],
      providers: [
        {
          provide: DiagnosesService,
          useValue: {
            list: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();
    document = SwaggerModule.createDocument(app, createSwaggerDocumentBuilder().build());
  });

  afterAll(async () => app.close());

  it('documents all five protected diagnosis operations', () => {
    const base = '/service-orders/{serviceOrderId}/diagnoses';
    expect(document.paths[base]?.get?.security).toEqual([{ bearer: [] }]);
    expect(document.paths[base]?.post?.security).toEqual([{ bearer: [] }]);
    expect(document.paths[`${base}/{id}`]?.get?.security).toEqual([{ bearer: [] }]);
    expect(document.paths[`${base}/{id}`]?.patch?.security).toEqual([{ bearer: [] }]);
    expect(document.paths[`${base}/{id}`]?.delete?.security).toEqual([{ bearer: [] }]);
  });

  it('publishes diagnosis fields in response schema', () => {
    const diagnosis = document.components?.schemas
      ?.DiagnosisResponseDto as OpenApiSchema | undefined;

    const fields = Object.keys(diagnosis?.properties ?? {});
    expect(fields).toEqual(
      expect.arrayContaining([
        'id',
        'serviceOrderId',
        'technician',
        'description',
        'requiredPartsNotes',
        'suggestedLabor',
        'createdAt',
        'updatedAt',
      ]),
    );
  });

  it('documents validation and authentication failures on every operation', () => {
    const base = '/service-orders/{serviceOrderId}/diagnoses';
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
});
