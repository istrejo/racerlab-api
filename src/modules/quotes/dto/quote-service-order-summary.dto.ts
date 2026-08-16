import { ApiProperty } from '@nestjs/swagger';
import { ServiceOrderStatus } from '@prisma/client';

export class QuoteServiceOrderSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'SO-0001' })
  code!: string;

  @ApiProperty({ enum: ServiceOrderStatus })
  status!: ServiceOrderStatus;
}
