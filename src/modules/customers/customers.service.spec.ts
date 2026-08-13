import { ConflictException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CustomersService } from './customers.service';

describe('CustomersService', () => {
  const context = {
    workshopId: 'e79033dc-7d16-421f-ae1a-d216f9a306d7',
    membershipId: '6650e2ef-c46a-4fe2-875e-4af7c576e12d',
    role: UserRole.OWNER,
  };
  const now = new Date('2026-08-13T12:00:00.000Z');
  const customer = {
    id: '2f1b7652-92f6-4a32-863f-26b5af5e0c12',
    workshopId: context.workshopId,
    fullName: 'Ana García',
    phone: '+34 600 123 456',
    whatsapp: null,
    email: 'ana@example.com',
    document: '12345678Z',
    address: null,
    notes: null,
    createdAt: now,
    updatedAt: now,
    _count: { vehicles: 2, serviceOrders: 3 },
  };
  const prisma = {
    customer: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const service = new CustomersService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(
      (value: unknown[] | ((tx: typeof prisma) => unknown)) =>
        Array.isArray(value) ? Promise.all(value) : value(prisma),
    );
  });

  it('creates a workshop-scoped customer with normalized contact data', async () => {
    prisma.customer.create.mockResolvedValue(customer);

    await expect(
      service.create(context, {
        fullName: ' Ana García ',
        phone: ' +34 600 123 456 ',
        whatsapp: ' ',
        email: ' ANA@EXAMPLE.COM ',
        document: ' 12345678-z ',
        address: '',
      }),
    ).resolves.toMatchObject({
      id: customer.id,
      vehicleCount: 2,
      serviceOrderCount: 3,
    });

    expect(prisma.customer.create).toHaveBeenCalledWith({
      data: {
        workshopId: context.workshopId,
        fullName: 'Ana García',
        phone: '+34 600 123 456',
        whatsapp: null,
        email: 'ana@example.com',
        document: '12345678Z',
        address: null,
        notes: null,
      },
      include: {
        _count: { select: { vehicles: true, serviceOrders: true } },
      },
    });
  });

  it('translates concurrent document uniqueness failures to conflict', async () => {
    prisma.customer.create.mockRejectedValue({ code: 'P2002' });

    await expect(
      service.create(context, {
        fullName: 'Duplicate',
        document: '12345678Z',
      }),
    ).rejects.toEqual(
      new ConflictException(
        'A customer with this document already exists in the workshop.',
      ),
    );
  });

  it('searches all customer identity fields inside the active workshop', async () => {
    prisma.customer.findMany.mockResolvedValue([customer]);
    prisma.customer.count.mockResolvedValue(1);

    await expect(
      service.list(context, { search: ' 1234-5678-z ', page: 2, limit: 10 }),
    ).resolves.toEqual({
      items: [expect.objectContaining({ id: customer.id })],
      page: 2,
      limit: 10,
      total: 1,
      totalPages: 1,
    });

    expect(prisma.customer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          workshopId: context.workshopId,
          OR: [
            { fullName: { contains: '1234-5678-z', mode: 'insensitive' } },
            { phone: { contains: '1234-5678-z', mode: 'insensitive' } },
            { whatsapp: { contains: '1234-5678-z', mode: 'insensitive' } },
            { email: { contains: '1234-5678-z', mode: 'insensitive' } },
            { document: { contains: '12345678Z', mode: 'insensitive' } },
          ],
        },
        orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
        skip: 10,
        take: 10,
      }),
    );
  });

  it('returns an empty first page with zero total pages', async () => {
    prisma.customer.findMany.mockResolvedValue([]);
    prisma.customer.count.mockResolvedValue(0);

    await expect(service.list(context, {})).resolves.toEqual({
      items: [],
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
    });
  });

  it('never exposes a customer from another workshop', async () => {
    prisma.customer.findFirst.mockResolvedValue(null);

    await expect(service.findOne(context, customer.id)).rejects.toEqual(
      new NotFoundException('Customer not found.'),
    );
    expect(prisma.customer.findFirst).toHaveBeenCalledWith({
      where: { id: customer.id, workshopId: context.workshopId },
      include: {
        _count: { select: { vehicles: true, serviceOrders: true } },
      },
    });
  });

  it('scopes updates before writing and normalizes changed values', async () => {
    prisma.customer.findFirst.mockResolvedValue({ id: customer.id });
    prisma.customer.update.mockResolvedValue({
      ...customer,
      email: 'new@example.com',
      document: null,
    });

    await service.update(context, customer.id, {
      email: ' NEW@EXAMPLE.COM ',
      document: '',
    });

    expect(prisma.customer.findFirst).toHaveBeenCalledWith({
      where: { id: customer.id, workshopId: context.workshopId },
      select: { id: true },
    });
    expect(prisma.customer.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: customer.id },
        data: { email: 'new@example.com', document: null },
      }),
    );
  });

  it('rejects deletion when vehicles or service orders retain history', async () => {
    prisma.customer.findFirst.mockResolvedValue(customer);

    await expect(service.remove(context, customer.id)).rejects.toEqual(
      new ConflictException(
        'Customers with vehicles or service orders cannot be deleted.',
      ),
    );
    expect(prisma.customer.delete).not.toHaveBeenCalled();
  });

  it('deletes an unreferenced customer after workshop-scoped lookup', async () => {
    prisma.customer.findFirst.mockResolvedValue({
      ...customer,
      _count: { vehicles: 0, serviceOrders: 0 },
    });
    prisma.customer.delete.mockResolvedValue(customer);

    await expect(service.remove(context, customer.id)).resolves.toBeUndefined();
    expect(prisma.customer.delete).toHaveBeenCalledWith({
      where: { id: customer.id },
    });
  });
});
