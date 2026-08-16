import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { createSwaggerDocumentBuilder } from '../../config/swagger.config';
import { QuotesOverviewController } from './quotes-overview.controller';
import { QuotesController } from './quotes.controller';
import { QuotesService } from './quotes.service';

type OpenApiSchema = {
  properties?: Record<string, unknown>;
  required?: string[];
};

describe('Quotes OpenAPI contract', () => {
  let app: INestApplication;
  let document: OpenAPIObject;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [QuotesOverviewController, QuotesController],
      providers: [
        {
          provide: QuotesService,
          useValue: {
            list: jest.fn(),
            listForWorkshop: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            changeStatus: jest.fn(),
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

  it('documents all five protected quote operations', () => {
    const base = '/service-orders/{serviceOrderId}/quotes';
    expect(document.paths[base]?.get?.security).toEqual([{ bearer: [] }]);
    expect(document.paths[base]?.post?.security).toEqual([{ bearer: [] }]);
    expect(document.paths[`${base}/{id}`]?.get?.security).toEqual([
      { bearer: [] },
    ]);
    expect(document.paths[`${base}/{id}`]?.patch?.security).toEqual([
      { bearer: [] },
    ]);
    expect(document.paths[`${base}/{id}/status`]?.patch?.security).toEqual([
      { bearer: [] },
    ]);
  });

  it('publishes quote fields in response schema', () => {
    const quote = document.components?.schemas?.QuoteResponseDto as
      OpenApiSchema | undefined;

    const fields = Object.keys(quote?.properties ?? {});
    expect(fields).toEqual(
      expect.arrayContaining([
        'id',
        'serviceOrderId',
        'status',
        'subtotal',
        'discount',
        'tax',
        'total',
        'approvalMethod',
        'approvedAt',
        'rejectedAt',
        'createdBy',
        'items',
        'createdAt',
        'updatedAt',
      ]),
    );
  });

  it('publishes quote item fields in response schema', () => {
    const item = document.components?.schemas?.QuoteItemResponseDto as
      OpenApiSchema | undefined;

    const fields = Object.keys(item?.properties ?? {});
    expect(fields).toEqual(
      expect.arrayContaining([
        'id',
        'type',
        'description',
        'quantity',
        'unitPrice',
        'costPrice',
        'total',
        'inventoryProductId',
        'isApproved',
        'createdAt',
        'updatedAt',
      ]),
    );
  });

  it('documents validation and authentication failures on every operation', () => {
    const base = '/service-orders/{serviceOrderId}/quotes';
    for (const operation of [
      document.paths[base]?.get,
      document.paths[base]?.post,
      document.paths[`${base}/{id}`]?.get,
      document.paths[`${base}/{id}`]?.patch,
      document.paths[`${base}/{id}/status`]?.patch,
    ]) {
      expect(operation?.responses).toHaveProperty('400');
      expect(operation?.responses).toHaveProperty('401');
    }
  });

  it('documents the workshop-wide quote listing', () => {
    const operation = document.paths['/quotes']?.get;

    expect(operation?.security).toEqual([{ bearer: [] }]);
    expect(operation?.responses).toHaveProperty('400');
    expect(operation?.responses).toHaveProperty('401');
    expect(
      operation?.parameters?.map((p) => (p as { name: string }).name),
    ).toEqual(
      expect.arrayContaining([
        'search',
        'status',
        'serviceOrderId',
        'page',
        'limit',
      ]),
    );
  });

  it('publishes quote summary fields in the page schema', () => {
    const summary = document.components?.schemas?.QuoteSummaryResponseDto as
      OpenApiSchema | undefined;

    expect(Object.keys(summary?.properties ?? {})).toEqual(
      expect.arrayContaining([
        'id',
        'status',
        'total',
        'itemCount',
        'serviceOrder',
        'customer',
        'vehicle',
        'createdBy',
        'createdAt',
      ]),
    );

    const pageSchema = document.components?.schemas?.QuotePageResponseDto as
      OpenApiSchema | undefined;
    expect(Object.keys(pageSchema?.properties ?? {})).toEqual(
      expect.arrayContaining(['items', 'page', 'limit', 'total', 'totalPages']),
    );
  });

  it('documents conflict responses on edit and status transition', () => {
    const base = '/service-orders/{serviceOrderId}/quotes';
    expect(document.paths[`${base}/{id}`]?.patch?.responses).toHaveProperty(
      '409',
    );
    expect(
      document.paths[`${base}/{id}/status`]?.patch?.responses,
    ).toHaveProperty('409');
  });
});
