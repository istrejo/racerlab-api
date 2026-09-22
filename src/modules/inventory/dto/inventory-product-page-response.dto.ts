import { ApiProperty } from '@nestjs/swagger';
import { InventoryProductResponseDto } from './inventory-product-response.dto';

export class InventoryProductPageResponseDto {
  @ApiProperty({ type: InventoryProductResponseDto, isArray: true })
  items!: InventoryProductResponseDto[];

  @ApiProperty({ minimum: 1 })
  page!: number;

  @ApiProperty({ minimum: 1, maximum: 100 })
  limit!: number;

  @ApiProperty({ minimum: 0 })
  total!: number;

  @ApiProperty({ minimum: 0 })
  totalPages!: number;
}
