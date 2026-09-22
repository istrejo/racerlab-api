import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InventoryMovementType, Prisma } from '@prisma/client';
import type { WorkshopContext } from '../../common/auth/workshop-context';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateInventoryProductDto } from './dto/create-inventory-product.dto';
import { InventoryProductPageResponseDto } from './dto/inventory-product-page-response.dto';
import { InventoryProductResponseDto } from './dto/inventory-product-response.dto';
import { ListInventoryProductsQueryDto } from './dto/list-inventory-products-query.dto';
import { UpdateInventoryProductDto } from './dto/update-inventory-product.dto';
import {
  assertNotNull,
  CATEGORY_SUMMARY_INCLUDE,
  decimalToNumber,
  isPrismaError,
  normalizeNullable,
  nullableDecimalToNumber,
  pageMeta,
  resolveActingUserId,
  toNullableDecimal,
} from './inventory.helpers';

type ProductWithCategory = Prisma.InventoryProductGetPayload<{
  include: typeof CATEGORY_SUMMARY_INCLUDE;
}>;

@Injectable()
export class InventoryProductsService {
  private readonly logger = new Logger(InventoryProductsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async list(
    context: WorkshopContext,
    query: ListInventoryProductsQueryDto,
  ): Promise<InventoryProductPageResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const search = query.search?.trim();
    const stockFilters: Prisma.InventoryProductWhereInput[] = [
      ...(query.lowStock === true
        ? [
            { minimumStock: { not: null } },
            {
              currentStock: {
                lte: this.prisma.inventoryProduct.fields.minimumStock,
              },
            },
          ]
        : []),
      ...(query.outOfStock === true ? [{ currentStock: { lte: 0 } }] : []),
    ];
    const where: Prisma.InventoryProductWhereInput = {
      workshopId: context.workshopId,
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { sku: { contains: search, mode: 'insensitive' } },
              { brand: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(stockFilters.length > 0 ? { AND: stockFilters } : {}),
    };

    const [products, total] = await this.prisma.$transaction([
      this.prisma.inventoryProduct.findMany({
        where,
        include: CATEGORY_SUMMARY_INCLUDE,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.inventoryProduct.count({ where }),
    ]);

    return {
      items: products.map((product) => this.toResponse(product)),
      ...pageMeta(page, limit, total),
    };
  }

  async findOne(
    context: WorkshopContext,
    productId: string,
  ): Promise<InventoryProductResponseDto> {
    const product = await this.prisma.inventoryProduct.findFirst({
      where: { id: productId, workshopId: context.workshopId },
      include: CATEGORY_SUMMARY_INCLUDE,
    });

    if (!product) {
      throw new NotFoundException('Inventory product not found.');
    }

    return this.toResponse(product);
  }

  async create(
    context: WorkshopContext,
    dto: CreateInventoryProductDto,
  ): Promise<InventoryProductResponseDto> {
    const initialStock = new Prisma.Decimal(dto.initialStock ?? 0);

    try {
      const product = await this.prisma.$transaction(async (tx) => {
        if (dto.categoryId) {
          await this.assertAssignableCategory(tx, context, dto.categoryId);
        }

        const created = await tx.inventoryProduct.create({
          data: {
            workshopId: context.workshopId,
            categoryId: dto.categoryId ?? null,
            name: dto.name.trim(),
            sku: normalizeNullable(dto.sku),
            brand: normalizeNullable(dto.brand),
            description: normalizeNullable(dto.description),
            unit: dto.unit,
            costPrice: toNullableDecimal(dto.costPrice),
            salePrice: toNullableDecimal(dto.salePrice),
            minimumStock: toNullableDecimal(dto.minimumStock),
            location: normalizeNullable(dto.location),
            currentStock: initialStock,
          },
          include: CATEGORY_SUMMARY_INCLUDE,
        });

        if (initialStock.greaterThan(0)) {
          const createdById = await resolveActingUserId(tx, context);
          await tx.inventoryMovement.create({
            data: {
              workshopId: context.workshopId,
              productId: created.id,
              createdById,
              type: InventoryMovementType.INBOUND,
              quantity: initialStock,
              previousStock: new Prisma.Decimal(0),
              newStock: initialStock,
              notes: 'Initial stock.',
            },
          });
        }

        return created;
      });

      this.logger.log(
        `Inventory product ${product.id} created in workshop ${context.workshopId} by membership ${context.membershipId}.`,
      );
      if (initialStock.greaterThan(0)) {
        this.logger.log(
          `Inventory movement INBOUND of ${initialStock.toString()} recorded for product ${product.id} (stock 0 -> ${initialStock.toString()}) in workshop ${context.workshopId} by membership ${context.membershipId}.`,
        );
      }
      return this.toResponse(product);
    } catch (error) {
      this.rethrowWriteError(error);
    }
  }

  async update(
    context: WorkshopContext,
    productId: string,
    dto: UpdateInventoryProductDto,
  ): Promise<InventoryProductResponseDto> {
    assertNotNull(dto, ['name', 'unit', 'isActive']);

    try {
      const product = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.inventoryProduct.findFirst({
          where: { id: productId, workshopId: context.workshopId },
          select: { id: true, categoryId: true },
        });

        if (!existing) {
          throw new NotFoundException('Inventory product not found.');
        }

        if (dto.categoryId && dto.categoryId !== existing.categoryId) {
          await this.assertAssignableCategory(tx, context, dto.categoryId);
        }

        return tx.inventoryProduct.update({
          where: { id: existing.id },
          data: this.buildUpdateData(dto),
          include: CATEGORY_SUMMARY_INCLUDE,
        });
      });

      this.logger.log(
        `Inventory product ${product.id} updated in workshop ${context.workshopId} by membership ${context.membershipId}.`,
      );
      return this.toResponse(product);
    } catch (error) {
      this.rethrowWriteError(error);
    }
  }

  private buildUpdateData(
    dto: UpdateInventoryProductDto,
  ): Prisma.InventoryProductUncheckedUpdateInput {
    const data: Prisma.InventoryProductUncheckedUpdateInput = {};

    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.sku !== undefined) data.sku = normalizeNullable(dto.sku);
    if (dto.brand !== undefined) data.brand = normalizeNullable(dto.brand);
    if (dto.description !== undefined) {
      data.description = normalizeNullable(dto.description);
    }
    if (dto.unit !== undefined) data.unit = dto.unit;
    if (dto.costPrice !== undefined) {
      data.costPrice = toNullableDecimal(dto.costPrice);
    }
    if (dto.salePrice !== undefined) {
      data.salePrice = toNullableDecimal(dto.salePrice);
    }
    if (dto.minimumStock !== undefined) {
      data.minimumStock = toNullableDecimal(dto.minimumStock);
    }
    if (dto.location !== undefined) {
      data.location = normalizeNullable(dto.location);
    }
    if (dto.categoryId !== undefined) data.categoryId = dto.categoryId;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    return data;
  }

  private async assertAssignableCategory(
    tx: Prisma.TransactionClient,
    context: WorkshopContext,
    categoryId: string,
  ): Promise<void> {
    const category = await tx.inventoryCategory.findFirst({
      where: { id: categoryId, workshopId: context.workshopId },
      select: { id: true, isActive: true },
    });

    if (!category) {
      throw new NotFoundException('Inventory category not found.');
    }

    if (!category.isActive) {
      throw new ConflictException(
        'Inactive inventory categories cannot be assigned to products.',
      );
    }
  }

  private toResponse(
    product: ProductWithCategory,
  ): InventoryProductResponseDto {
    return {
      id: product.id,
      name: product.name,
      sku: product.sku,
      brand: product.brand,
      description: product.description,
      unit: product.unit,
      costPrice: nullableDecimalToNumber(product.costPrice),
      salePrice: nullableDecimalToNumber(product.salePrice),
      currentStock: decimalToNumber(product.currentStock),
      minimumStock: nullableDecimalToNumber(product.minimumStock),
      isLowStock:
        product.minimumStock !== null &&
        product.currentStock.lessThanOrEqualTo(product.minimumStock),
      location: product.location,
      isActive: product.isActive,
      category: product.category
        ? {
            id: product.category.id,
            name: product.category.name,
            isActive: product.category.isActive,
          }
        : null,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }

  private rethrowWriteError(error: unknown): never {
    if (isPrismaError(error, 'P2002')) {
      throw new ConflictException(
        'An inventory product with this SKU already exists in the workshop.',
      );
    }
    throw error;
  }
}
