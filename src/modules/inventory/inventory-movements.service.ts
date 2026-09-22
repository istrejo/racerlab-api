import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InventoryMovementType, Prisma } from '@prisma/client';
import type { WorkshopContext } from '../../common/auth/workshop-context';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CLIENT_MOVEMENT_TYPES,
  CreateInventoryMovementDto,
} from './dto/create-inventory-movement.dto';
import { MAX_QUANTITY } from './dto/inventory-limits';
import { InventoryMovementPageResponseDto } from './dto/inventory-movement-page-response.dto';
import { InventoryMovementResponseDto } from './dto/inventory-movement-response.dto';
import { ListInventoryMovementsQueryDto } from './dto/list-inventory-movements-query.dto';
import {
  decimalToNumber,
  MOVEMENT_INCLUDE,
  normalizeNullable,
  nullableDecimalToNumber,
  pageMeta,
  resolveActingUserId,
} from './inventory.helpers';

/** Movement types that may carry the service order that caused them. */
const ORDER_LINKED_TYPES: InventoryMovementType[] = [
  InventoryMovementType.OUTBOUND,
  InventoryMovementType.RETURN,
];

type MovementWithCreator = Prisma.InventoryMovementGetPayload<{
  include: typeof MOVEMENT_INCLUDE;
}>;

type LockedProduct = {
  id: string;
  currentStock: Prisma.Decimal;
  isActive: boolean;
};

type StockChange = {
  quantity: Prisma.Decimal;
  previousStock: Prisma.Decimal;
  newStock: Prisma.Decimal;
};

@Injectable()
export class InventoryMovementsService {
  private readonly logger = new Logger(InventoryMovementsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async list(
    context: WorkshopContext,
    productId: string,
    query: ListInventoryMovementsQueryDto,
  ): Promise<InventoryMovementPageResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const product = await this.prisma.inventoryProduct.findFirst({
      where: { id: productId, workshopId: context.workshopId },
      select: { id: true },
    });
    if (!product) {
      throw new NotFoundException('Inventory product not found.');
    }

    const where: Prisma.InventoryMovementWhereInput = {
      workshopId: context.workshopId,
      productId: product.id,
      ...(query.type ? { type: query.type } : {}),
    };

    const [movements, total] = await this.prisma.$transaction([
      this.prisma.inventoryMovement.findMany({
        where,
        include: MOVEMENT_INCLUDE,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.inventoryMovement.count({ where }),
    ]);

    return {
      items: movements.map((movement) => this.toResponse(movement)),
      ...pageMeta(page, limit, total),
    };
  }

  async create(
    context: WorkshopContext,
    productId: string,
    dto: CreateInventoryMovementDto,
  ): Promise<InventoryMovementResponseDto> {
    this.assertMovementShape(dto);

    const movement = await this.prisma.$transaction(async (tx) => {
      const product = await this.lockProduct(tx, context, productId);

      if (!product.isActive) {
        throw new ConflictException(
          'Inactive inventory products cannot receive stock movements.',
        );
      }

      if (dto.serviceOrderId) {
        await this.assertServiceOrderExists(tx, context, dto.serviceOrderId);
      }

      const change = this.computeStockChange(
        dto,
        new Prisma.Decimal(product.currentStock),
      );
      const createdById = await resolveActingUserId(tx, context);

      await tx.inventoryProduct.update({
        where: { id: product.id },
        data: { currentStock: change.newStock },
      });

      return tx.inventoryMovement.create({
        data: {
          workshopId: context.workshopId,
          productId: product.id,
          serviceOrderId: dto.serviceOrderId ?? null,
          createdById,
          type: dto.type,
          quantity: change.quantity,
          previousStock: change.previousStock,
          newStock: change.newStock,
          notes: normalizeNullable(dto.notes),
        },
        include: MOVEMENT_INCLUDE,
      });
    });

    this.logger.log(
      `Inventory movement ${movement.type} of ${movement.quantity.toString()} recorded for product ${movement.productId} (stock ${movement.previousStock?.toString()} -> ${movement.newStock?.toString()}) in workshop ${context.workshopId} by membership ${context.membershipId}.`,
    );
    return this.toResponse(movement);
  }

  /** Cross-field rules the DTO cannot express, checked before any database work. */
  private assertMovementShape(dto: CreateInventoryMovementDto): void {
    if (!(CLIENT_MOVEMENT_TYPES as readonly string[]).includes(dto.type)) {
      throw new BadRequestException(
        `${dto.type} movements are managed by the server and cannot be created manually.`,
      );
    }

    if (dto.type === InventoryMovementType.ADJUSTMENT) {
      if (dto.countedStock === undefined || dto.countedStock === null) {
        throw new BadRequestException(
          'countedStock is required for ADJUSTMENT movements.',
        );
      }
      if (dto.quantity !== undefined && dto.quantity !== null) {
        throw new BadRequestException(
          'quantity is not allowed for ADJUSTMENT movements; send countedStock instead.',
        );
      }
    } else {
      if (dto.quantity === undefined || dto.quantity === null) {
        throw new BadRequestException(
          `quantity is required for ${dto.type} movements.`,
        );
      }
      if (dto.countedStock !== undefined && dto.countedStock !== null) {
        throw new BadRequestException(
          'countedStock is only allowed for ADJUSTMENT movements.',
        );
      }
    }

    if (dto.serviceOrderId && !ORDER_LINKED_TYPES.includes(dto.type)) {
      throw new BadRequestException(
        'serviceOrderId is only allowed for OUTBOUND and RETURN movements.',
      );
    }
  }

  private computeStockChange(
    dto: CreateInventoryMovementDto,
    previousStock: Prisma.Decimal,
  ): StockChange {
    let quantity: Prisma.Decimal;
    let newStock: Prisma.Decimal;

    switch (dto.type) {
      case InventoryMovementType.ADJUSTMENT: {
        newStock = new Prisma.Decimal(dto.countedStock as number);
        if (newStock.equals(previousStock)) {
          throw new BadRequestException(
            'The counted stock matches the current stock; no adjustment is needed.',
          );
        }
        quantity = newStock.minus(previousStock).abs();
        break;
      }
      case InventoryMovementType.OUTBOUND: {
        quantity = new Prisma.Decimal(dto.quantity as number);
        newStock = previousStock.minus(quantity);
        if (newStock.isNegative()) {
          throw new ConflictException(
            `Insufficient stock: ${previousStock.toString()} available, ${quantity.toString()} requested. Stock cannot become negative.`,
          );
        }
        break;
      }
      default: {
        quantity = new Prisma.Decimal(dto.quantity as number);
        newStock = previousStock.plus(quantity);
        break;
      }
    }

    if (newStock.greaterThan(MAX_QUANTITY)) {
      throw new ConflictException(
        'The resulting stock exceeds the maximum supported quantity.',
      );
    }

    return { quantity, previousStock, newStock };
  }

  /**
   * Serializes every stock write for one product on its row, so concurrent
   * movements cannot read the same stock and overwrite each other.
   */
  private async lockProduct(
    tx: Prisma.TransactionClient,
    context: WorkshopContext,
    productId: string,
  ): Promise<LockedProduct> {
    const locked = await tx.$queryRaw<LockedProduct[]>`
      SELECT "id", "current_stock" AS "currentStock", "is_active" AS "isActive"
      FROM "inventory_products"
      WHERE "id" = ${productId}::uuid
        AND "workshop_id" = ${context.workshopId}::uuid
      FOR UPDATE
    `;

    if (locked.length !== 1) {
      throw new NotFoundException('Inventory product not found.');
    }

    return locked[0];
  }

  private async assertServiceOrderExists(
    tx: Prisma.TransactionClient,
    context: WorkshopContext,
    serviceOrderId: string,
  ): Promise<void> {
    const order = await tx.serviceOrder.findFirst({
      where: { id: serviceOrderId, workshopId: context.workshopId },
      select: { id: true },
    });
    if (!order) {
      throw new NotFoundException('Service order not found.');
    }
  }

  private toResponse(
    movement: MovementWithCreator,
  ): InventoryMovementResponseDto {
    return {
      id: movement.id,
      productId: movement.productId,
      serviceOrderId: movement.serviceOrderId,
      type: movement.type,
      quantity: decimalToNumber(movement.quantity),
      previousStock: nullableDecimalToNumber(movement.previousStock),
      newStock: nullableDecimalToNumber(movement.newStock),
      notes: movement.notes,
      createdBy: {
        userId: movement.createdBy.userId,
        displayName: movement.createdBy.displayName,
      },
      createdAt: movement.createdAt,
    };
  }
}
