import { ApiProperty } from '@nestjs/swagger';
import { QuoteStatus } from '@prisma/client';
import { CustomerSummaryDto } from '../../service-orders/dto/customer-summary.dto';
import { MemberSummaryDto } from '../../service-orders/dto/member-summary.dto';
import { VehicleSummaryDto } from '../../service-orders/dto/vehicle-summary.dto';
import { QuoteServiceOrderSummaryDto } from './quote-service-order-summary.dto';

export class QuoteSummaryResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: QuoteStatus })
  status!: QuoteStatus;

  @ApiProperty({ example: 91 })
  total!: number;

  @ApiProperty({ example: 3, description: 'Number of line items in the quote.' })
  itemCount!: number;

  @ApiProperty({ type: QuoteServiceOrderSummaryDto })
  serviceOrder!: QuoteServiceOrderSummaryDto;

  @ApiProperty({ type: CustomerSummaryDto })
  customer!: CustomerSummaryDto;

  @ApiProperty({ type: VehicleSummaryDto })
  vehicle!: VehicleSummaryDto;

  @ApiProperty({ type: MemberSummaryDto })
  createdBy!: MemberSummaryDto;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;
}
