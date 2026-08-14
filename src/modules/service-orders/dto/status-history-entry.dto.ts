import { ApiProperty } from '@nestjs/swagger';
import { ServiceOrderStatus } from '@prisma/client';
import { MemberSummaryDto } from './member-summary.dto';

export class StatusHistoryEntryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: ServiceOrderStatus, nullable: true, type: String })
  previousStatus!: ServiceOrderStatus | null;

  @ApiProperty({ enum: ServiceOrderStatus })
  newStatus!: ServiceOrderStatus;

  @ApiProperty({ type: MemberSummaryDto })
  changedBy!: MemberSummaryDto;

  @ApiProperty({ nullable: true, type: String })
  comment!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;
}
