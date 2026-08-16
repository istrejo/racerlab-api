import { ApiProperty } from '@nestjs/swagger';
import { VehicleWithCustomerResponseDto } from './vehicle-with-customer-response.dto';

export class VehicleWithCustomerPageResponseDto {
  @ApiProperty({ type: [VehicleWithCustomerResponseDto] })
  items!: VehicleWithCustomerResponseDto[];

  @ApiProperty({ minimum: 1 })
  page!: number;

  @ApiProperty({ minimum: 1 })
  limit!: number;

  @ApiProperty({ minimum: 0 })
  total!: number;

  @ApiProperty({ minimum: 0 })
  totalPages!: number;
}
