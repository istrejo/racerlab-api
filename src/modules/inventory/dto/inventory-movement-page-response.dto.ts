import { ApiProperty } from '@nestjs/swagger';
import { InventoryMovementResponseDto } from './inventory-movement-response.dto';

export class InventoryMovementPageResponseDto {
  @ApiProperty({ type: InventoryMovementResponseDto, isArray: true })
  items!: InventoryMovementResponseDto[];

  @ApiProperty({ minimum: 1 })
  page!: number;

  @ApiProperty({ minimum: 1, maximum: 100 })
  limit!: number;

  @ApiProperty({ minimum: 0 })
  total!: number;

  @ApiProperty({ minimum: 0 })
  totalPages!: number;
}
