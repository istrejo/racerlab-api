import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ServiceOrderStatus, UserRole } from '@prisma/client';
import { ServiceOrdersService } from './service-orders.service';

describe('ServiceOrdersService', () => {
  const context = {
    workshopId: 'e79033dc-7d16-421f-ae1a-d216f9a306d7',
    membershipId: '6650e2ef-c46a-4fe2-875e-4af7c576e12d',
    role: UserRole.OWNER,
  };
  const customerId = 'c1b2a3d4-0000-0000-0000-000000000001';
  const vehicleId = 'v1b2a3d4-0000-0000-0000-000000000001';
  const orderId = 'o1b2a3d4-0000-0000-0000-000000000001';
  const membershipUserId = 'u1b2a3d4-0000-0000-0000-000000000001';
  const techMembershipId = 't1b2a3d4-0000-0000-0000-000000000001';
  const techUserId = 'u2b2a3d4-0000-0000-0000-000000000002';
  const now = new Date('2026-08-14T12:00:00.000Z');

  const baseOrder = {
    id: orderId,
    code: 'SO-0001',
    workshopId: context.workshopId,
    customerId,
    vehicleId,
    assignedTechnicianId: null,
    createdById: membershipUserId,
    status: ServiceOrderStatus.RECEIVED,
    priority: null,
    reportedIssues: null,
    receptionNotes: null,
    mileageIn: null,
    fuelLevel: null,
    estimatedDeliveryDate: null,
    totalEstimated: null,
    totalApproved: null,
    totalFinal: null,
    closedAt: null,
    createdAt: now,
    updatedAt: now,
    customer: { id: customerId, fullName: 'María García' },
    vehicle: { id: vehicleId, plate: 'ABC1234', brand: 'Toyota', model: 'Corolla' },
    assignedTechnician: null,
    createdBy: { userId: membershipUserId, displayName: 'Juan Pérez' },
    statusHistory: [
      {
        id: 'h1',
        previousStatus: null,
        newStatus: ServiceOrderStatus.RECEIVED,
        comment: null,
        createdAt: now,
        changedBy: { userId: membershipUserId, displayName: 'Juan Pérez' },
      },
    ],
    _count: { diagnoses: 0 },
  };

  const prisma = {
    membership: { findFirst: jest.fn() },
    customer: { findFirst: jest.fn() },
    vehicle: { findFirst: jest.fn() },
    serviceOrder: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const service = new ServiceOrdersService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(
      (value: unknown[] | ((tx: typeof prisma) => unknown)) =>
        Array.isArray(value) ? Promise.all(value) : value(prisma),
    );
    prisma.membership.findFirst.mockResolvedValue({ userId: membershipUserId });
    prisma.customer.findFirst.mockResolvedValue({ id: customerId });
    prisma.vehicle.findFirst.mockResolvedValue({ id: vehicleId });
    prisma.serviceOrder.findFirst.mockResolvedValue(null);
  });

  it('creates a service order with auto-generated code and initial status history', async () => {
    prisma.serviceOrder.create.mockResolvedValue(baseOrder);

    const result = await service.create(context, {
      customerId,
      vehicleId,
      reportedIssues: 'Ruido al frenar',
    });

    expect(result).toMatchObject({ code: 'SO-0001', status: ServiceOrderStatus.RECEIVED });
    expect(prisma.serviceOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workshopId: context.workshopId,
          customerId,
          vehicleId,
          createdById: membershipUserId,
          code: 'SO-0001',
          statusHistory: expect.objectContaining({
            create: expect.objectContaining({
              newStatus: ServiceOrderStatus.RECEIVED,
              previousStatus: null,
            }),
          }),
        }),
      }),
    );
  });

  it('generates sequential code starting from SO-0001 when no prior orders exist', async () => {
    prisma.serviceOrder.findFirst.mockResolvedValueOnce(null); // code lookup
    prisma.serviceOrder.create.mockResolvedValue(baseOrder);

    await service.create(context, { customerId, vehicleId });

    expect(prisma.serviceOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ code: 'SO-0001' }) }),
    );
  });

  it('increments code from the last existing order', async () => {
    prisma.serviceOrder.findFirst.mockResolvedValueOnce({ code: 'SO-0005' }); // code lookup
    prisma.serviceOrder.create.mockResolvedValue({ ...baseOrder, code: 'SO-0006' });

    await service.create(context, { customerId, vehicleId });

    expect(prisma.serviceOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ code: 'SO-0006' }) }),
    );
  });

  it('throws NotFoundException when customer does not exist in the workshop', async () => {
    prisma.customer.findFirst.mockResolvedValue(null);

    await expect(service.create(context, { customerId, vehicleId })).rejects.toEqual(
      new NotFoundException('Customer not found.'),
    );
    expect(prisma.serviceOrder.create).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when vehicle does not belong to customer', async () => {
    prisma.vehicle.findFirst.mockResolvedValue(null);

    await expect(service.create(context, { customerId, vehicleId })).rejects.toEqual(
      new NotFoundException('Vehicle not found for this customer.'),
    );
    expect(prisma.serviceOrder.create).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when assigned technician membership does not exist', async () => {
    prisma.membership.findFirst
      .mockResolvedValueOnce({ userId: membershipUserId }) // creator
      .mockResolvedValueOnce(null); // technician

    await expect(
      service.create(context, { customerId, vehicleId, technicianId: techMembershipId }),
    ).rejects.toEqual(new NotFoundException('Technician not found.'));
  });

  it('lists service orders with pagination and scopes to workshop', async () => {
    prisma.serviceOrder.findMany.mockResolvedValue([baseOrder]);
    prisma.serviceOrder.count.mockResolvedValue(1);

    const result = await service.list(context, { page: 1, limit: 10 });

    expect(result).toEqual({
      items: [expect.objectContaining({ id: orderId, code: 'SO-0001' })],
      page: 1,
      limit: 10,
      total: 1,
      totalPages: 1,
    });
    expect(prisma.serviceOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { workshopId: context.workshopId } }),
    );
  });

  it('filters list by status when provided', async () => {
    prisma.serviceOrder.findMany.mockResolvedValue([]);
    prisma.serviceOrder.count.mockResolvedValue(0);

    await service.list(context, { status: ServiceOrderStatus.DIAGNOSIS });

    expect(prisma.serviceOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: ServiceOrderStatus.DIAGNOSIS }),
      }),
    );
  });

  it('returns zero total pages for an empty list', async () => {
    prisma.serviceOrder.findMany.mockResolvedValue([]);
    prisma.serviceOrder.count.mockResolvedValue(0);

    const result = await service.list(context, {});

    expect(result.total).toBe(0);
    expect(result.totalPages).toBe(0);
  });

  it('throws NotFoundException when service order is not in the workshop', async () => {
    prisma.serviceOrder.findFirst.mockResolvedValue(null);

    await expect(service.findOne(context, orderId)).rejects.toEqual(
      new NotFoundException('Service order not found.'),
    );
  });

  it('rejects invalid status transition', async () => {
    prisma.serviceOrder.findFirst.mockResolvedValue({
      id: orderId,
      status: ServiceOrderStatus.RECEIVED,
      code: 'SO-0001',
    });

    await expect(
      service.changeStatus(context, orderId, { status: ServiceOrderStatus.DELIVERED }),
    ).rejects.toEqual(
      new BadRequestException('Cannot transition from RECEIVED to DELIVERED.'),
    );
  });

  it('allows valid status transition and records history', async () => {
    prisma.serviceOrder.findFirst.mockResolvedValueOnce({
      id: orderId,
      status: ServiceOrderStatus.RECEIVED,
      code: 'SO-0001',
    });
    const updated = { ...baseOrder, status: ServiceOrderStatus.DIAGNOSIS };
    prisma.serviceOrder.update.mockResolvedValue(updated);

    const result = await service.changeStatus(context, orderId, {
      status: ServiceOrderStatus.DIAGNOSIS,
      comment: 'Moving to diagnosis',
    });

    expect(result.status).toBe(ServiceOrderStatus.DIAGNOSIS);
    expect(prisma.serviceOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: ServiceOrderStatus.DIAGNOSIS,
          statusHistory: expect.objectContaining({
            create: expect.objectContaining({
              previousStatus: ServiceOrderStatus.RECEIVED,
              newStatus: ServiceOrderStatus.DIAGNOSIS,
              comment: 'Moving to diagnosis',
            }),
          }),
        }),
      }),
    );
  });

  it('sets closedAt when transitioning to DELIVERED', async () => {
    prisma.serviceOrder.findFirst.mockResolvedValueOnce({
      id: orderId,
      status: ServiceOrderStatus.READY_FOR_DELIVERY,
      code: 'SO-0001',
    });
    prisma.serviceOrder.update.mockResolvedValue({
      ...baseOrder,
      status: ServiceOrderStatus.DELIVERED,
      closedAt: now,
    });

    await service.changeStatus(context, orderId, { status: ServiceOrderStatus.DELIVERED });

    expect(prisma.serviceOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          closedAt: expect.any(Date),
        }),
      }),
    );
  });

  it('rejects updating a DELIVERED order by a non-admin', async () => {
    prisma.serviceOrder.findFirst.mockResolvedValue({
      id: orderId,
      status: ServiceOrderStatus.DELIVERED,
    });
    const nonAdminContext = { ...context, role: UserRole.ADVISOR };

    await expect(
      service.update(nonAdminContext, orderId, { receptionNotes: 'edit' }),
    ).rejects.toEqual(new ForbiddenException('Delivered orders cannot be modified.'));
  });

  it('assigns a technician by resolving userId from membership', async () => {
    prisma.serviceOrder.findFirst.mockResolvedValue({ id: orderId, status: ServiceOrderStatus.RECEIVED });
    prisma.membership.findFirst.mockResolvedValueOnce({ userId: techUserId });
    prisma.serviceOrder.update.mockResolvedValue({
      ...baseOrder,
      assignedTechnicianId: techUserId,
      assignedTechnician: { userId: techUserId, displayName: 'Tech Ana' },
    });

    const result = await service.assignTechnician(context, orderId, {
      technicianId: techMembershipId,
    });

    expect(prisma.serviceOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { assignedTechnicianId: techUserId } }),
    );
    expect(result.assignedTechnician).toEqual({ userId: techUserId, displayName: 'Tech Ana' });
  });

  it('unassigns technician when technicianId is null', async () => {
    prisma.serviceOrder.findFirst.mockResolvedValue({ id: orderId, status: ServiceOrderStatus.IN_PROGRESS });
    prisma.serviceOrder.update.mockResolvedValue({ ...baseOrder, assignedTechnicianId: null });

    await service.assignTechnician(context, orderId, { technicianId: null });

    expect(prisma.serviceOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { assignedTechnicianId: null } }),
    );
  });
});
