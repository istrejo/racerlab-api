import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { WorkshopContext } from '../../common/auth/workshop-context';

export const CATEGORY_SUMMARY_INCLUDE = {
  category: { select: { id: true, name: true, isActive: true } },
} as const;

export const MOVEMENT_INCLUDE = {
  createdBy: { select: { userId: true, displayName: true } },
} as const;

export function isPrismaError(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === code
  );
}

export function decimalToNumber(value: Prisma.Decimal): number {
  return value.toNumber();
}

export function nullableDecimalToNumber(
  value: Prisma.Decimal | null,
): number | null {
  return value === null ? null : value.toNumber();
}

export function toNullableDecimal(
  value: number | null | undefined,
): Prisma.Decimal | null {
  return value === null || value === undefined
    ? null
    : new Prisma.Decimal(value);
}

export function normalizeNullable(
  value: string | null | undefined,
): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

/**
 * `PartialType` marks every field optional, which also lets `null` through.
 * Non-nullable columns must reject an explicit null instead of crashing later.
 */
export function assertNotNull<T extends object>(
  dto: T,
  fields: ReadonlyArray<keyof T & string>,
): void {
  for (const field of fields) {
    if (dto[field] === null) {
      throw new BadRequestException(`${field} cannot be null.`);
    }
  }
}

/**
 * Movements reference the creator membership by `(workshopId, userId)`, so the
 * acting membership must be resolved to its user id inside the workshop.
 */
export async function resolveActingUserId(
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

export function pageMeta(page: number, limit: number, total: number) {
  return {
    page,
    limit,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  };
}
