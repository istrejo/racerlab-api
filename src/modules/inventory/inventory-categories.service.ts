import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { WorkshopContext } from '../../common/auth/workshop-context';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateInventoryCategoryDto } from './dto/create-inventory-category.dto';
import { InventoryCategoryPageResponseDto } from './dto/inventory-category-page-response.dto';
import { InventoryCategoryResponseDto } from './dto/inventory-category-response.dto';
import { ListInventoryCategoriesQueryDto } from './dto/list-inventory-categories-query.dto';
import { UpdateInventoryCategoryDto } from './dto/update-inventory-category.dto';
import {
  assertNotNull,
  isPrismaError,
  normalizeNullable,
  pageMeta,
} from './inventory.helpers';

const CATEGORY_COUNTS = { select: { products: true } } as const;

type CategoryWithCounts = Prisma.InventoryCategoryGetPayload<{
  include: { _count: typeof CATEGORY_COUNTS };
}>;

@Injectable()
export class InventoryCategoriesService {
  private readonly logger = new Logger(InventoryCategoriesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async list(
    context: WorkshopContext,
    query: ListInventoryCategoriesQueryDto,
  ): Promise<InventoryCategoryPageResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const search = query.search?.trim();
    const where: Prisma.InventoryCategoryWhereInput = {
      workshopId: context.workshopId,
      ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
      ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
    };

    const [categories, total] = await this.prisma.$transaction([
      this.prisma.inventoryCategory.findMany({
        where,
        include: { _count: CATEGORY_COUNTS },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.inventoryCategory.count({ where }),
    ]);

    return {
      items: categories.map((category) => this.toResponse(category)),
      ...pageMeta(page, limit, total),
    };
  }

  async create(
    context: WorkshopContext,
    dto: CreateInventoryCategoryDto,
  ): Promise<InventoryCategoryResponseDto> {
    try {
      const category = await this.prisma.inventoryCategory.create({
        data: {
          workshopId: context.workshopId,
          name: dto.name.trim(),
          description: normalizeNullable(dto.description),
        },
        include: { _count: CATEGORY_COUNTS },
      });

      this.logger.log(
        `Inventory category ${category.id} created in workshop ${context.workshopId} by membership ${context.membershipId}.`,
      );
      return this.toResponse(category);
    } catch (error) {
      this.rethrowWriteError(error);
    }
  }

  async update(
    context: WorkshopContext,
    categoryId: string,
    dto: UpdateInventoryCategoryDto,
  ): Promise<InventoryCategoryResponseDto> {
    assertNotNull(dto, ['name', 'isActive']);

    try {
      const category = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.inventoryCategory.findFirst({
          where: { id: categoryId, workshopId: context.workshopId },
          select: { id: true },
        });

        if (!existing) {
          throw new NotFoundException('Inventory category not found.');
        }

        return tx.inventoryCategory.update({
          where: { id: existing.id },
          data: {
            ...(dto.name === undefined ? {} : { name: dto.name.trim() }),
            ...(dto.description === undefined
              ? {}
              : { description: normalizeNullable(dto.description) }),
            ...(dto.isActive === undefined ? {} : { isActive: dto.isActive }),
          },
          include: { _count: CATEGORY_COUNTS },
        });
      });

      this.logger.log(
        `Inventory category ${category.id} updated in workshop ${context.workshopId} by membership ${context.membershipId}.`,
      );
      return this.toResponse(category);
    } catch (error) {
      this.rethrowWriteError(error);
    }
  }

  private toResponse(
    category: CategoryWithCounts,
  ): InventoryCategoryResponseDto {
    return {
      id: category.id,
      name: category.name,
      description: category.description,
      isActive: category.isActive,
      productCount: category._count.products,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    };
  }

  private rethrowWriteError(error: unknown): never {
    if (isPrismaError(error, 'P2002')) {
      throw new ConflictException(
        'An inventory category with this name already exists in the workshop.',
      );
    }
    throw error;
  }
}
