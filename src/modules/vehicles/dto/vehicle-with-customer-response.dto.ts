import { ApiProperty } from '@nestjs/swagger';
import { CustomerSummaryDto } from '../../service-orders/dto/customer-summary.dto';
import { VehicleResponseDto } from './vehicle-response.dto';

export class VehicleWithCustomerResponseDto extends VehicleResponseDto {
  @ApiProperty({ type: CustomerSummaryDto })
  customer!: CustomerSummaryDto;
}
