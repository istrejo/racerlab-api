import { ApiProperty } from '@nestjs/swagger';
import { InventoryMovementType } from '@prisma/client';
import { MemberSummaryDto } from '../../service-orders/dto/member-summary.dto';

export class InventoryMovementResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  productId!: string;

  @ApiProperty({ nullable: true, type: String, format: 'uuid' })
  serviceOrderId!: string | null;

  @ApiProperty({ enum: InventoryMovementType })
  type!: InventoryMovementType;

  @ApiProperty({
    type: Number,
    example: 2,
    description:
      'Always positive. For ADJUSTMENT it is the absolute difference between the count and the previous stock.',
  })
  quantity!: number;

  @ApiProperty({ nullable: true, type: Number, example: 10 })
  previousStock!: number | null;

  @ApiProperty({ nullable: true, type: Number, example: 8 })
  newStock!: number | null;

  @ApiProperty({ nullable: true, type: String })
  notes!: string | null;

  @ApiProperty({ type: MemberSummaryDto })
  createdBy!: MemberSummaryDto;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;
}
