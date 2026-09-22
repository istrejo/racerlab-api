import { ApiProperty } from '@nestjs/swagger';
import { ProductUnit } from '@prisma/client';
import { InventoryCategorySummaryDto } from './inventory-category-summary.dto';

export class InventoryProductResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Brake pads (front)' })
  name!: string;

  @ApiProperty({ nullable: true, type: String })
  sku!: string | null;

  @ApiProperty({ nullable: true, type: String })
  brand!: string | null;

  @ApiProperty({ nullable: true, type: String })
  description!: string | null;

  @ApiProperty({ enum: ProductUnit })
  unit!: ProductUnit;

  @ApiProperty({ nullable: true, type: Number, example: 30.5 })
  costPrice!: number | null;

  @ApiProperty({ nullable: true, type: Number, example: 45 })
  salePrice!: number | null;

  @ApiProperty({
    type: Number,
    example: 10,
    description: 'Read-only. Changes only through inventory movements.',
  })
  currentStock!: number;

  @ApiProperty({ nullable: true, type: Number, example: 5 })
  minimumStock!: number | null;

  @ApiProperty({
    description:
      'True when a minimum stock is set and the current stock is at or below it.',
  })
  isLowStock!: boolean;

  @ApiProperty({ nullable: true, type: String })
  location!: string | null;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty({ type: InventoryCategorySummaryDto, nullable: true })
  category!: InventoryCategorySummaryDto | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;
}
