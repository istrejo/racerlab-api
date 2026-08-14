import { NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { DiagnosesService } from './diagnoses.service';

describe('DiagnosesService', () => {
  const context = {
    workshopId: 'e79033dc-7d16-421f-ae1a-d216f9a306d7',
    membershipId: '6650e2ef-c46a-4fe2-875e-4af7c576e12d',
    role: UserRole.TECHNICIAN,
  };
  const serviceOrderId = 'o1b2a3d4-0000-0000-0000-000000000001';
  const diagnosisId = 'd1b2a3d4-0000-0000-0000-000000000001';
  const techUserId = 'u1b2a3d4-0000-0000-0000-000000000001';
  const now = new Date('2026-08-14T12:00:00.000Z');

  const baseDiagnosis = {
    id: diagnosisId,
    workshopId: context.workshopId,
    serviceOrderId,
    technicianId: techUserId,
    description: 'Pastillas de freno desgastadas.',
    requiredPartsNotes: null,
    suggestedLabor: null,
    createdAt: now,
    updatedAt: now,
    technician: { userId: techUserId, displayName: 'Ana Técnica' },
  };

  const prisma = {
    membership: { findFirst: jest.fn() },
    serviceOrder: { findFirst: jest.fn() },
    diagnosis: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const service = new DiagnosesService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(
      (value: unknown[] | ((tx: typeof prisma) => unknown)) =>
        Array.isArray(value) ? Promise.all(value) : value(prisma),
    );
    prisma.serviceOrder.findFirst.mockResolvedValue({ id: serviceOrderId });
    prisma.membership.findFirst.mockResolvedValue({ userId: techUserId });
  });

  it('creates a diagnosis under a valid service order', async () => {
    prisma.diagnosis.create.mockResolvedValue(baseDiagnosis);

    const result = await service.create(context, serviceOrderId, {
      description: 'Pastillas de freno desgastadas.',
    });

    expect(result).toMatchObject({
      id: diagnosisId,
      serviceOrderId,
      description: 'Pastillas de freno desgastadas.',
      technician: { userId: techUserId, displayName: 'Ana Técnica' },
    });
    expect(prisma.diagnosis.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workshopId: context.workshopId,
          serviceOrderId,
          technicianId: techUserId,
        }),
      }),
    );
  });

  it('throws NotFoundException when service order does not exist', async () => {
    prisma.serviceOrder.findFirst.mockResolvedValue(null);

    await expect(
      service.create(context, serviceOrderId, { description: 'Test' }),
    ).rejects.toEqual(new NotFoundException('Service order not found.'));
    expect(prisma.diagnosis.create).not.toHaveBeenCalled();
  });

  it('lists diagnoses scoped to service order and workshop', async () => {
    prisma.diagnosis.findMany.mockResolvedValue([baseDiagnosis]);

    const result = await service.list(context, serviceOrderId);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: diagnosisId });
    expect(prisma.diagnosis.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { serviceOrderId, workshopId: context.workshopId },
      }),
    );
  });

  it('throws NotFoundException when listing for non-existent service order', async () => {
    prisma.serviceOrder.findFirst.mockResolvedValue(null);

    await expect(service.list(context, serviceOrderId)).rejects.toEqual(
      new NotFoundException('Service order not found.'),
    );
  });

  it('throws NotFoundException when fetching a diagnosis from another order', async () => {
    prisma.diagnosis.findFirst.mockResolvedValue(null);

    await expect(service.findOne(context, serviceOrderId, diagnosisId)).rejects.toEqual(
      new NotFoundException('Diagnosis not found.'),
    );
  });

  it('updates a diagnosis when found', async () => {
    prisma.diagnosis.findFirst.mockResolvedValue({ id: diagnosisId });
    const updated = { ...baseDiagnosis, description: 'Updated description.' };
    prisma.diagnosis.update.mockResolvedValue(updated);

    const result = await service.update(context, serviceOrderId, diagnosisId, {
      description: 'Updated description.',
    });

    expect(result.description).toBe('Updated description.');
    expect(prisma.diagnosis.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: diagnosisId },
        data: { description: 'Updated description.' },
      }),
    );
  });

  it('throws NotFoundException on update when diagnosis not found', async () => {
    prisma.diagnosis.findFirst.mockResolvedValue(null);

    await expect(
      service.update(context, serviceOrderId, diagnosisId, { description: 'x' }),
    ).rejects.toEqual(new NotFoundException('Diagnosis not found.'));
  });

  it('deletes a diagnosis when found', async () => {
    prisma.diagnosis.findFirst.mockResolvedValue({ id: diagnosisId });
    prisma.diagnosis.delete.mockResolvedValue(baseDiagnosis);

    await expect(service.remove(context, serviceOrderId, diagnosisId)).resolves.toBeUndefined();
    expect(prisma.diagnosis.delete).toHaveBeenCalledWith({ where: { id: diagnosisId } });
  });

  it('throws NotFoundException on delete when diagnosis not found', async () => {
    prisma.diagnosis.findFirst.mockResolvedValue(null);

    await expect(service.remove(context, serviceOrderId, diagnosisId)).rejects.toEqual(
      new NotFoundException('Diagnosis not found.'),
    );
    expect(prisma.diagnosis.delete).not.toHaveBeenCalled();
  });
});
