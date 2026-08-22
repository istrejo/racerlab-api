import { ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import type { AuthenticatedUser } from '../src/common/auth/authenticated-user';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { RolesGuard } from '../src/common/guards/roles.guard';
import { WorkshopContextGuard } from '../src/common/guards/workshop-context.guard';
import { CustomersController } from '../src/modules/customers/customers.controller';
import { CustomersService } from '../src/modules/customers/customers.service';
import { configureApp } from '../src/main';

describe('Customers API (e2e)', () => {
  const workshopId = 'e79033dc-7d16-421f-ae1a-d216f9a306d7';
  const membershipId = '6650e2ef-c46a-4fe2-875e-4af7c576e12d';
  const customerId = '2f1b7652-92f6-4a32-863f-26b5af5e0c12';
  const customer = {
    id: customerId,
    fullName: 'Ana García',
    phone: null,
    whatsapp: null,
    email: 'ana@example.com',
    document: '12345678Z',
    address: null,
    notes: null,
    vehicleCount: 0,
    serviceOrderCount: 0,
    createdAt: new Date('2026-08-13T12:00:00.000Z'),
    updatedAt: new Date('2026-08-13T12:00:00.000Z'),
  };
  const customersService = {
    list: jest.fn().mockResolvedValue({
      items: [customer],
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
    }),
    findOne: jest.fn().mockResolvedValue(customer),
    create: jest.fn().mockResolvedValue(customer),
    update: jest.fn().mockResolvedValue(customer),
    remove: jest.fn().mockResolvedValue(undefined),
  };
  let app: INestApplication<App>;
  let currentRole = UserRole.ADMIN;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [CustomersController],
      providers: [
        WorkshopContextGuard,
        RolesGuard,
        { provide: CustomersService, useValue: customersService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          context
            .switchToHttp()
            .getRequest<{ user?: AuthenticatedUser }>().user = {
            id: '93125e08-aea8-4622-9a79-2bf44db6b6d7',
            email: 'operator@example.com',
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
    currentRole = UserRole.ADMIN;
    jest.clearAllMocks();
  });

  it('serves the paginated list with transformed query values', async () => {
    await request(app.getHttpServer())
      .get(
        '/api/customers?search=%20Ana%20&hasVehicles=false&hasServiceOrders=true&sort=NEWEST&page=2&limit=10',
      )
      .expect(200);

    expect(customersService.list).toHaveBeenCalledWith(
      { workshopId, membershipId, role: UserRole.ADMIN },
      {
        search: 'Ana',
        hasVehicles: false,
        hasServiceOrders: true,
        sort: 'NEWEST',
        page: 2,
        limit: 10,
      },
    );
  });

  it('serves detail, create, update, and delete routes', async () => {
    await request(app.getHttpServer())
      .get(`/api/customers/${customerId}`)
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/customers')
      .send({ fullName: ' Ana García ', email: ' ANA@EXAMPLE.COM ' })
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/api/customers/${customerId}`)
      .send({ notes: ' Prefer WhatsApp ' })
      .expect(200);
    await request(app.getHttpServer())
      .delete(`/api/customers/${customerId}`)
      .expect(204);

    expect(customersService.create).toHaveBeenCalledWith(
      expect.objectContaining({ workshopId }),
      { fullName: 'Ana García', email: 'ana@example.com' },
    );
  });

  it('rejects invalid pagination and unknown write fields', async () => {
    await request(app.getHttpServer())
      .get('/api/customers?page=0&limit=101')
      .expect(400);
    await request(app.getHttpServer())
      .get('/api/customers?hasVehicles=maybe&sort=INVALID')
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/customers')
      .send({ fullName: 'Ana', secret: 'not-allowed' })
      .expect(400);
  });

  it('allows technicians to read but not write', async () => {
    currentRole = UserRole.TECHNICIAN;
    await request(app.getHttpServer()).get('/api/customers').expect(200);
    await request(app.getHttpServer())
      .post('/api/customers')
      .send({ fullName: 'Ana' })
      .expect(403);
  });

  it('allows owners to use every customer CRUD route', async () => {
    currentRole = UserRole.OWNER;
    await request(app.getHttpServer()).get('/api/customers').expect(200);
    await request(app.getHttpServer())
      .post('/api/customers')
      .send({ fullName: 'Owner Customer' })
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/api/customers/${customerId}`)
      .send({ notes: 'Owner update' })
      .expect(200);
    await request(app.getHttpServer())
      .delete(`/api/customers/${customerId}`)
      .expect(204);
  });

  it('denies inventory roles and restricts deletion to owner or admin', async () => {
    currentRole = UserRole.INVENTORY_MANAGER;
    await request(app.getHttpServer()).get('/api/customers').expect(403);

    currentRole = UserRole.MANAGER;
    await request(app.getHttpServer())
      .delete(`/api/customers/${customerId}`)
      .expect(403);

    currentRole = UserRole.OWNER;
    await request(app.getHttpServer())
      .delete(`/api/customers/${customerId}`)
      .expect(204);
  });
});
