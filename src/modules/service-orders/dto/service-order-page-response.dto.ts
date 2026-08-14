import { ApiProperty } from '@nestjs/swagger';
import { ServiceOrderResponseDto } from './service-order-response.dto';

export class ServiceOrderPageResponseDto {
  @ApiProperty({ type: [ServiceOrderResponseDto] })
  items!: ServiceOrderResponseDto[];

  @ApiProperty({ minimum: 1 })
  page!: number;

  @ApiProperty({ minimum: 1 })
  limit!: number;

  @ApiProperty({ minimum: 0 })
  total!: number;

  @ApiProperty({ minimum: 0 })
  totalPages!: number;
}
