import { ApiProperty } from '@nestjs/swagger';
import { InventoryCategoryResponseDto } from './inventory-category-response.dto';

export class InventoryCategoryPageResponseDto {
  @ApiProperty({ type: InventoryCategoryResponseDto, isArray: true })
  items!: InventoryCategoryResponseDto[];

  @ApiProperty({ minimum: 1 })
  page!: number;

  @ApiProperty({ minimum: 1, maximum: 100 })
  limit!: number;

  @ApiProperty({ minimum: 0 })
  total!: number;

  @ApiProperty({ minimum: 0 })
  totalPages!: number;
}
