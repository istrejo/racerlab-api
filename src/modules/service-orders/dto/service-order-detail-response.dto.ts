import { ApiProperty } from '@nestjs/swagger';
import { MemberSummaryDto } from './member-summary.dto';
import { ServiceOrderResponseDto } from './service-order-response.dto';
import { StatusHistoryEntryDto } from './status-history-entry.dto';

export class ServiceOrderDetailResponseDto extends ServiceOrderResponseDto {
  @ApiProperty({ type: MemberSummaryDto })
  createdBy!: MemberSummaryDto;

  @ApiProperty({ type: [StatusHistoryEntryDto] })
  statusHistory!: StatusHistoryEntryDto[];
}
