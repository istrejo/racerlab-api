import { ApiProperty } from '@nestjs/swagger';
import { QuoteItemType } from '@prisma/client';

export class QuoteItemResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: QuoteItemType })
  type!: QuoteItemType;

  @ApiProperty({ example: 'Pastillas de freno delanteras' })
  description!: string;

  @ApiProperty({ example: 2 })
  quantity!: number;

  @ApiProperty({ example: 45.5 })
  unitPrice!: number;

  @ApiProperty({ nullable: true, type: Number })
  costPrice!: number | null;

  @ApiProperty({ example: 91 })
  total!: number;

  @ApiProperty({ nullable: true, type: String, format: 'uuid' })
  inventoryProductId!: string | null;

  @ApiProperty({ nullable: true, type: Boolean })
  isApproved!: boolean | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;
}
