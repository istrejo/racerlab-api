import {
  ConflictException,
  ExecutionContext,
  INestApplication,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { QuoteApprovalMethod, QuoteStatus, UserRole } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import type { AuthenticatedUser } from '../src/common/auth/authenticated-user';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { RolesGuard } from '../src/common/guards/roles.guard';
import { WorkshopContextGuard } from '../src/common/guards/workshop-context.guard';
import { QuotesController } from '../src/modules/quotes/quotes.controller';
import { QuotesService } from '../src/modules/quotes/quotes.service';
import { configureApp } from '../src/main';

type StoredQuote = {
  id: string;
  serviceOrderId: string;
  status: QuoteStatus;
  version: number;
  sourceQuoteId: string | null;
  currencyCode: string;
  subtotal: number;
  discount: number | null;
  tax: number | null;
  total: number;
  approvalMethod: QuoteApprovalMethod | null;
  approvalMethodDetail: string | null;
  approvedAt: Date | null;
  rejectedAt: Date | null;
  createdBy: { userId: string; displayName: string };
  items: [];
  createdAt: Date;
  updatedAt: Date;
};

describe('Quotes API (e2e)', () => {
  const workshopId = 'e79033dc-7d16-421f-ae1a-d216f9a306d7';
  const membershipId = '6650e2ef-c46a-4fe2-875e-4af7c576e12d';
  const serviceOrderId = '8c4d3a8c-2d24-4a8e-8b1e-2b0e5ad7d101';
  const foreignServiceOrderId = '1f4ad0f4-0d26-4a2c-9f6b-2c0a2d5f9e22';
  const advisor = {
    userId: '0b3f6c2e-6d35-4d5d-9b2c-6f2a1f1f9a01',
    displayName: 'Ana Asesora',
  };
  const timestamp = new Date('2026-09-19T10:00:00.000Z');

  /**
   * A small in-memory aggregate: enough to drive the real controller through a
   * complete diagnosis → v1 → activate → v2 → supersede → approve journey.
   */
  const store = new Map<string, StoredQuote>();
  let nextId = 0;

  const newQuote = (
    overrides: Partial<StoredQuote> & { version: number },
  ): StoredQuote => {
    nextId += 1;
    const quote: StoredQuote = {
      id: `0000000${nextId}-0000-4000-8000-000000000000`,
      serviceOrderId,
      status: QuoteStatus.DRAFT,
      sourceQuoteId: null,
      currencyCode: 'EUR',
      subtotal: 100,
      discount: null,
      tax: null,
      total: 100,
      approvalMethod: null,
      approvalMethodDetail: null,
      approvedAt: null,
      rejectedAt: null,
      createdBy: advisor,
      items: [],
      createdAt: timestamp,
      updatedAt: timestamp,
      ...overrides,
    };
    store.set(quote.id, quote);
    return quote;
  };

  const assertOwnOrder = (id: string): void => {
    if (id !== serviceOrderId) {
      throw new NotFoundException('Service order not found.');
    }
  };

  const quotesService = {
    list: jest.fn((_ctx: unknown, orderId: string) => {
      assertOwnOrder(orderId);
      return Promise.resolve(
        [...store.values()].sort((a, b) => b.version - a.version),
      );
    }),
    findOne: jest.fn((_ctx: unknown, orderId: string, quoteId: string) => {
      assertOwnOrder(orderId);
      const quote = store.get(quoteId);
      if (!quote) {
        throw new NotFoundException('Quote not found.');
      }
      return Promise.resolve(quote);
    }),
    create: jest.fn((_ctx: unknown, orderId: string) => {
      assertOwnOrder(orderId);
      if (store.size > 0) {
        throw new ConflictException(
          'This service order already has a quote. Create a new version instead.',
        );
      }
      return Promise.resolve(newQuote({ version: 1 }));
    }),
    createVersion: jest.fn(
      (_ctx: unknown, orderId: string, quoteId: string) => {
        assertOwnOrder(orderId);
        const source = store.get(quoteId);
        if (!source) {
          throw new NotFoundException('Quote not found.');
        }
        if (
          source.status === QuoteStatus.DRAFT ||
          source.status === QuoteStatus.APPROVED
        ) {
          throw new ConflictException(
            `A quote in status ${source.status} cannot be versioned.`,
          );
        }
        return Promise.resolve(
          newQuote({ version: source.version + 1, sourceQuoteId: source.id }),
        );
      },
    ),
    update: jest.fn(() => Promise.resolve([...store.values()][0])),
    changeStatus: jest.fn(
      (
        _ctx: unknown,
        orderId: string,
        quoteId: string,
        dto: {
          status: QuoteStatus;
          approvalMethod?: QuoteApprovalMethod | null;
          approvalMethodDetail?: string | null;
        },
      ) => {
        assertOwnOrder(orderId);
        const quote = store.get(quoteId);
        if (!quote) {
          throw new NotFoundException('Quote not found.');
        }
        if (dto.status === QuoteStatus.ACTIVE) {
          for (const other of store.values()) {
            if (other.id !== quote.id && other.status === QuoteStatus.ACTIVE) {
              other.status = QuoteStatus.SUPERSEDED;
            }
          }
        }
        quote.status = dto.status;
        if (dto.status === QuoteStatus.APPROVED) {
          quote.approvalMethod = dto.approvalMethod ?? null;
          quote.approvalMethodDetail = dto.approvalMethodDetail ?? null;
          quote.approvedAt = timestamp;
        }
        return Promise.resolve(quote);
      },
    ),
  };

  let app: INestApplication<App>;
  let currentRole: UserRole = UserRole.ADVISOR;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [QuotesController],
      providers: [
        WorkshopContextGuard,
        RolesGuard,
        { provide: QuotesService, useValue: quotesService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          context
            .switchToHttp()
            .getRequest<{ user?: AuthenticatedUser }>().user = {
            id: '93125e08-aea8-4622-9a79-2bf44db6b6d7',
            email: 'advisor@example.com',
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
    currentRole = UserRole.ADVISOR;
  });

  const base = `/api/service-orders/${serviceOrderId}/quotes`;

  describe('authorization', () => {
    beforeEach(() => {
      store.clear();
      newQuote({ version: 1 });
    });

    it('lets a technician read quotes', async () => {
      currentRole = UserRole.TECHNICIAN;

      await request(app.getHttpServer()).get(base).expect(200);
    });

    it('forbids a technician from creating a quote', async () => {
      currentRole = UserRole.TECHNICIAN;

      await request(app.getHttpServer())
        .post(base)
        .send({
          items: [
            { type: 'PART', description: 'Filtro', quantity: 1, unitPrice: 10 },
          ],
        })
        .expect(403);
    });

    it('forbids a technician from creating a new version', async () => {
      currentRole = UserRole.TECHNICIAN;
      const [quote] = [...store.values()];

      await request(app.getHttpServer())
        .post(`${base}/${quote.id}/versions`)
        .expect(403);
    });
  });

  describe('foreign and invalid resources', () => {
    beforeEach(() => {
      store.clear();
      newQuote({ version: 1 });
    });

    it('returns 404 for a service order in another workshop', async () => {
      await request(app.getHttpServer())
        .get(`/api/service-orders/${foreignServiceOrderId}/quotes`)
        .expect(404);
    });

    it('returns 404 for a quote that does not belong to the order', async () => {
      await request(app.getHttpServer())
        .get(`${base}/2a1f0b4e-4a2f-4f6d-9b1e-0c1d2e3f4a5b`)
        .expect(404);
    });

    it('rejects a non-UUID quote id', async () => {
      await request(app.getHttpServer()).get(`${base}/not-a-uuid`).expect(400);
    });

    it('rejects a status the client may not assign', async () => {
      const [quote] = [...store.values()];

      await request(app.getHttpServer())
        .patch(`${base}/${quote.id}/status`)
        .send({ status: QuoteStatus.SUPERSEDED })
        .expect(400);
    });

    it('rejects an unsupported currency code', async () => {
      await request(app.getHttpServer())
        .post(base)
        .send({
          items: [
            { type: 'PART', description: 'Filtro', quantity: 1, unitPrice: 10 },
          ],
          currencyCode: 'XYZ',
        })
        .expect(400);
    });
  });

  describe('diagnosis to approval journey', () => {
    beforeEach(() => {
      store.clear();
      nextId = 0;
    });

    it('walks v1 → activate → v2 → supersede → approve', async () => {
      const created = await request(app.getHttpServer())
        .post(base)
        .send({
          items: [
            {
              type: 'PART',
              description: 'Pastillas',
              quantity: 2,
              unitPrice: 50,
            },
          ],
        })
        .expect(201);
      expect(created.body).toMatchObject({ version: 1, currencyCode: 'EUR' });

      await request(app.getHttpServer())
        .post(base)
        .send({
          items: [
            { type: 'PART', description: 'Otro', quantity: 1, unitPrice: 5 },
          ],
        })
        .expect(409);

      const firstId = (created.body as { id: string }).id;
      await request(app.getHttpServer())
        .patch(`${base}/${firstId}/status`)
        .send({ status: QuoteStatus.ACTIVE })
        .expect(200);

      const second = await request(app.getHttpServer())
        .post(`${base}/${firstId}/versions`)
        .expect(201);
      expect(second.body).toMatchObject({
        version: 2,
        sourceQuoteId: firstId,
        status: QuoteStatus.DRAFT,
      });

      const secondId = (second.body as { id: string }).id;
      await request(app.getHttpServer())
        .patch(`${base}/${secondId}/status`)
        .send({ status: QuoteStatus.ACTIVE })
        .expect(200);

      const afterSupersede = await request(app.getHttpServer())
        .get(`${base}/${firstId}`)
        .expect(200);
      expect((afterSupersede.body as { status: QuoteStatus }).status).toBe(
        QuoteStatus.SUPERSEDED,
      );

      const approved = await request(app.getHttpServer())
        .patch(`${base}/${secondId}/status`)
        .send({
          status: QuoteStatus.APPROVED,
          approvalMethod: QuoteApprovalMethod.WHATSAPP,
        })
        .expect(200);
      expect(approved.body).toMatchObject({
        status: QuoteStatus.APPROVED,
        approvalMethod: QuoteApprovalMethod.WHATSAPP,
      });

      await request(app.getHttpServer())
        .post(`${base}/${secondId}/versions`)
        .expect(409);

      const listed = await request(app.getHttpServer()).get(base).expect(200);
      expect(
        (listed.body as Array<{ version: number }>).map((q) => q.version),
      ).toEqual([2, 1]);
    });
  });
});
