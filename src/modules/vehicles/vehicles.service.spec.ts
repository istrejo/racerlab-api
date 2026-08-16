import { ConflictException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { VehiclesService } from './vehicles.service';

describe('VehiclesService', () => {
  const context = {
    workshopId: 'e79033dc-7d16-421f-ae1a-d216f9a306d7',
    membershipId: '6650e2ef-c46a-4fe2-875e-4af7c576e12d',
    role: UserRole.OWNER,
  };
  const customerId = 'c1b2a3d4-0000-0000-0000-000000000001';
  const now = new Date('2026-08-13T12:00:00.000Z');

  const vehicle = {
    id: 'v1b2a3d4-0000-0000-0000-000000000001',
    workshopId: context.workshopId,
    customerId,
    plate: 'ABC1234',
    brand: 'Toyota',
    model: 'Corolla',
    year: 2019,
    color: 'Blanco',
    vin: null,
    mileage: 45000,
    vehicleType: 'Sedán',
    notes: null,
    createdAt: now,
    updatedAt: now,
    _count: { serviceOrders: 0 },
  };

  const prisma = {
    customer: {
      findFirst: jest.fn(),
    },
    vehicle: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const service = new VehiclesService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.customer.findFirst.mockResolvedValue({ id: customerId });
    prisma.$transaction.mockImplementation(
      (value: unknown[] | ((tx: typeof prisma) => unknown)) =>
        Array.isArray(value) ? Promise.all(value) : value(prisma),
    );
  });

  it('creates a vehicle with normalized plate and trims brand/model', async () => {
    prisma.vehicle.create.mockResolvedValue(vehicle);

    await expect(
      service.create(context, customerId, {
        plate: ' abc 1234 ',
        brand: ' Toyota ',
        model: ' Corolla ',
        year: 2019,
        color: 'Blanco',
        mileage: 45000,
        vehicleType: 'Sedán',
      }),
    ).resolves.toMatchObject({
      id: vehicle.id,
      plate: 'ABC1234',
      brand: 'Toyota',
    });

    expect(prisma.vehicle.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workshopId: context.workshopId,
        customerId,
        plate: 'ABC1234',
        brand: 'Toyota',
        model: 'Corolla',
      }),
      include: { _count: { select: { serviceOrders: true } } },
    });
  });

  it('throws NotFoundException when customer does not exist in the workshop', async () => {
    prisma.customer.findFirst.mockResolvedValue(null);

    await expect(
      service.create(context, customerId, {
        plate: 'XYZ9999',
        brand: 'Honda',
        model: 'Civic',
      }),
    ).rejects.toEqual(new NotFoundException('Customer not found.'));

    expect(prisma.vehicle.create).not.toHaveBeenCalled();
  });

  it('translates duplicate plate to ConflictException', async () => {
    prisma.vehicle.create.mockRejectedValue({ code: 'P2002' });

    await expect(
      service.create(context, customerId, {
        plate: 'ABC1234',
        brand: 'Honda',
        model: 'Civic',
      }),
    ).rejects.toEqual(
      new ConflictException(
        'A vehicle with this plate already exists in the workshop.',
      ),
    );
  });

  it('lists vehicles for a customer with pagination', async () => {
    prisma.vehicle.findMany.mockResolvedValue([vehicle]);
    prisma.vehicle.count.mockResolvedValue(1);

    await expect(
      service.list(context, customerId, { page: 1, limit: 10 }),
    ).resolves.toEqual({
      items: [expect.objectContaining({ id: vehicle.id })],
      page: 1,
      limit: 10,
      total: 1,
      totalPages: 1,
    });

    expect(prisma.vehicle.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workshopId: context.workshopId, customerId },
        skip: 0,
        take: 10,
      }),
    );
  });

  it('searches across plate, brand, and model', async () => {
    prisma.vehicle.findMany.mockResolvedValue([vehicle]);
    prisma.vehicle.count.mockResolvedValue(1);

    await service.list(context, customerId, {
      search: 'Toyota',
      page: 1,
      limit: 20,
    });

    expect(prisma.vehicle.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          workshopId: context.workshopId,
          customerId,
          OR: [
            { plate: { contains: 'Toyota', mode: 'insensitive' } },
            { brand: { contains: 'Toyota', mode: 'insensitive' } },
            { model: { contains: 'Toyota', mode: 'insensitive' } },
          ],
        },
      }),
    );
  });

  it('returns zero total pages for an empty list', async () => {
    prisma.vehicle.findMany.mockResolvedValue([]);
    prisma.vehicle.count.mockResolvedValue(0);

    await expect(service.list(context, customerId, {})).resolves.toEqual({
      items: [],
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
    });
  });

  describe('listForWorkshop', () => {
    const vehicleWithCustomer = {
      ...vehicle,
      customer: { id: customerId, fullName: 'María García' },
    };

    beforeEach(() => {
      prisma.vehicle.findMany.mockResolvedValue([vehicleWithCustomer]);
      prisma.vehicle.count.mockResolvedValue(1);
    });

    it('lists every workshop vehicle with its customer summary', async () => {
      const result = await service.listForWorkshop(context, {
        page: 1,
        limit: 20,
      });

      expect(result).toMatchObject({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      });
      expect(result.items[0]).toMatchObject({
        id: vehicle.id,
        plate: 'ABC1234',
        serviceOrderCount: 0,
        customer: { id: customerId, fullName: 'María García' },
      });
      expect(prisma.vehicle.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { workshopId: context.workshopId } }),
      );
    });

    it('searches across plate, brand, model, and customer name', async () => {
      await service.listForWorkshop(context, {
        search: 'garcia',
        page: 1,
        limit: 20,
      });

      const where = prisma.vehicle.findMany.mock.calls[0][0].where;
      expect(where.OR).toEqual([
        { plate: { contains: 'garcia', mode: 'insensitive' } },
        { brand: { contains: 'garcia', mode: 'insensitive' } },
        { model: { contains: 'garcia', mode: 'insensitive' } },
        { customer: { fullName: { contains: 'garcia', mode: 'insensitive' } } },
      ]);
    });

    it('skips rows for pages beyond the first', async () => {
      await service.listForWorkshop(context, { page: 2, limit: 15 });

      expect(prisma.vehicle.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 15, take: 15 }),
      );
    });

    it('reports zero pages when the workshop has no vehicles', async () => {
      prisma.vehicle.findMany.mockResolvedValue([]);
      prisma.vehicle.count.mockResolvedValue(0);

      await expect(
        service.listForWorkshop(context, { page: 1, limit: 20 }),
      ).resolves.toMatchObject({ items: [], total: 0, totalPages: 0 });
    });
  });

  it('never exposes a vehicle from another customer or workshop', async () => {
    prisma.vehicle.findFirst.mockResolvedValue(null);

    await expect(
      service.findOne(context, customerId, vehicle.id),
    ).rejects.toEqual(new NotFoundException('Vehicle not found.'));

    expect(prisma.vehicle.findFirst).toHaveBeenCalledWith({
      where: {
        id: vehicle.id,
        workshopId: context.workshopId,
        customerId,
      },
      include: { _count: { select: { serviceOrders: true } } },
    });
  });

  it('scopes update lookup by customer and workshop before writing', async () => {
    prisma.vehicle.findFirst.mockResolvedValue({ id: vehicle.id });
    prisma.vehicle.update.mockResolvedValue({ ...vehicle, mileage: 50000 });

    await service.update(context, customerId, vehicle.id, { mileage: 50000 });

    expect(prisma.vehicle.findFirst).toHaveBeenCalledWith({
      where: { id: vehicle.id, workshopId: context.workshopId, customerId },
      select: { id: true },
    });
    expect(prisma.vehicle.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: vehicle.id },
        data: { mileage: 50000 },
      }),
    );
  });

  it('rejects deletion when service orders exist', async () => {
    prisma.vehicle.findFirst.mockResolvedValue({
      ...vehicle,
      _count: { serviceOrders: 3 },
    });

    await expect(
      service.remove(context, customerId, vehicle.id),
    ).rejects.toEqual(
      new ConflictException('Vehicles with service orders cannot be deleted.'),
    );

    expect(prisma.vehicle.delete).not.toHaveBeenCalled();
  });

  it('deletes an unreferenced vehicle after workshop-scoped lookup', async () => {
    prisma.vehicle.findFirst.mockResolvedValue({
      ...vehicle,
      _count: { serviceOrders: 0 },
    });
    prisma.vehicle.delete.mockResolvedValue(vehicle);

    await expect(
      service.remove(context, customerId, vehicle.id),
    ).resolves.toBeUndefined();

    expect(prisma.vehicle.delete).toHaveBeenCalledWith({
      where: { id: vehicle.id },
    });
  });
});
