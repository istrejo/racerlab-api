import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { WorkshopContext } from '../../common/auth/workshop-context';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateDiagnosisDto } from './dto/create-diagnosis.dto';
import { DiagnosisResponseDto } from './dto/diagnosis-response.dto';
import { UpdateDiagnosisDto } from './dto/update-diagnosis.dto';

const DIAGNOSIS_INCLUDE = {
  technician: { select: { userId: true, displayName: true } },
} as const;

type DiagnosisWithRelations = Prisma.DiagnosisGetPayload<{ include: typeof DIAGNOSIS_INCLUDE }>;

@Injectable()
export class DiagnosesService {
  private readonly logger = new Logger(DiagnosesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(
    context: WorkshopContext,
    serviceOrderId: string,
    dto: CreateDiagnosisDto,
  ): Promise<DiagnosisResponseDto> {
    const technicianUserId = await this.prisma.$transaction(async (tx) => {
      await this.assertServiceOrderExists(tx, context, serviceOrderId);
      return this.resolveUserId(tx, context);
    });

    const diagnosis = await this.prisma.diagnosis.create({
      data: {
        workshopId: context.workshopId,
        serviceOrderId,
        technicianId: technicianUserId,
        description: dto.description,
        requiredPartsNotes: dto.requiredPartsNotes ?? null,
        suggestedLabor: dto.suggestedLabor ?? null,
      },
      include: DIAGNOSIS_INCLUDE,
    });

    this.logger.log(
      `Diagnosis ${diagnosis.id} created for service order ${serviceOrderId} in workshop ${context.workshopId} by membership ${context.membershipId}.`,
    );
    return this.toResponse(diagnosis);
  }

  async list(
    context: WorkshopContext,
    serviceOrderId: string,
  ): Promise<DiagnosisResponseDto[]> {
    await this.assertServiceOrderExists(this.prisma, context, serviceOrderId);

    const diagnoses = await this.prisma.diagnosis.findMany({
      where: { serviceOrderId, workshopId: context.workshopId },
      include: DIAGNOSIS_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });

    return diagnoses.map((d) => this.toResponse(d));
  }

  async findOne(
    context: WorkshopContext,
    serviceOrderId: string,
    diagnosisId: string,
  ): Promise<DiagnosisResponseDto> {
    const diagnosis = await this.findScoped(context, serviceOrderId, diagnosisId);

    if (!diagnosis) {
      throw new NotFoundException('Diagnosis not found.');
    }

    return this.toResponse(diagnosis);
  }

  async update(
    context: WorkshopContext,
    serviceOrderId: string,
    diagnosisId: string,
    dto: UpdateDiagnosisDto,
  ): Promise<DiagnosisResponseDto> {
    const diagnosis = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.diagnosis.findFirst({
        where: { id: diagnosisId, serviceOrderId, workshopId: context.workshopId },
        select: { id: true },
      });

      if (!existing) {
        throw new NotFoundException('Diagnosis not found.');
      }

      return tx.diagnosis.update({
        where: { id: existing.id },
        data: {
          ...(dto.description !== undefined ? { description: dto.description } : {}),
          ...(dto.requiredPartsNotes !== undefined
            ? { requiredPartsNotes: dto.requiredPartsNotes ?? null }
            : {}),
          ...(dto.suggestedLabor !== undefined
            ? { suggestedLabor: dto.suggestedLabor ?? null }
            : {}),
        },
        include: DIAGNOSIS_INCLUDE,
      });
    });

    this.logger.log(
      `Diagnosis ${diagnosis.id} updated in workshop ${context.workshopId} by membership ${context.membershipId}.`,
    );
    return this.toResponse(diagnosis);
  }

  async remove(
    context: WorkshopContext,
    serviceOrderId: string,
    diagnosisId: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.diagnosis.findFirst({
        where: { id: diagnosisId, serviceOrderId, workshopId: context.workshopId },
        select: { id: true },
      });

      if (!existing) {
        throw new NotFoundException('Diagnosis not found.');
      }

      await tx.diagnosis.delete({ where: { id: existing.id } });
    });

    this.logger.log(
      `Diagnosis ${diagnosisId} deleted from workshop ${context.workshopId} by membership ${context.membershipId}.`,
    );
  }

  private async assertServiceOrderExists(
    tx: Prisma.TransactionClient | PrismaService,
    context: WorkshopContext,
    serviceOrderId: string,
  ): Promise<void> {
    const order = await (tx as Prisma.TransactionClient).serviceOrder.findFirst({
      where: { id: serviceOrderId, workshopId: context.workshopId },
      select: { id: true },
    });
    if (!order) {
      throw new NotFoundException('Service order not found.');
    }
  }

  private async resolveUserId(
    tx: Prisma.TransactionClient,
    context: WorkshopContext,
  ): Promise<string> {
    const membership = await tx.membership.findFirst({
      where: { id: context.membershipId, workshopId: context.workshopId },
      select: { userId: true },
    });
    if (!membership) {
      throw new NotFoundException('Membership not found.');
    }
    return membership.userId;
  }

  private findScoped(
    context: WorkshopContext,
    serviceOrderId: string,
    diagnosisId: string,
  ) {
    return this.prisma.diagnosis.findFirst({
      where: { id: diagnosisId, serviceOrderId, workshopId: context.workshopId },
      include: DIAGNOSIS_INCLUDE,
    });
  }

  private toResponse(diagnosis: DiagnosisWithRelations): DiagnosisResponseDto {
    return {
      id: diagnosis.id,
      serviceOrderId: diagnosis.serviceOrderId,
      technician: {
        userId: diagnosis.technician.userId,
        displayName: diagnosis.technician.displayName,
      },
      description: diagnosis.description,
      requiredPartsNotes: diagnosis.requiredPartsNotes,
      suggestedLabor: diagnosis.suggestedLabor,
      createdAt: diagnosis.createdAt,
      updatedAt: diagnosis.updatedAt,
    };
  }
}
