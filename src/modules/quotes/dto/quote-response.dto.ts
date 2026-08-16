import { ApiProperty } from '@nestjs/swagger';
import { QuoteStatus } from '@prisma/client';
import { MemberSummaryDto } from '../../service-orders/dto/member-summary.dto';
import { QuoteItemResponseDto } from './quote-item-response.dto';

export class QuoteResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  serviceOrderId!: string;

  @ApiProperty({ enum: QuoteStatus })
  status!: QuoteStatus;

  @ApiProperty({ example: 91 })
  subtotal!: number;

  @ApiProperty({ nullable: true, type: Number })
  discount!: number | null;

  @ApiProperty({ nullable: true, type: Number })
  tax!: number | null;

  @ApiProperty({ example: 91 })
  total!: number;

  @ApiProperty({ nullable: true, type: String })
  approvalMethod!: string | null;

  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  approvedAt!: Date | null;

  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  rejectedAt!: Date | null;

  @ApiProperty({ type: MemberSummaryDto })
  createdBy!: MemberSummaryDto;

  @ApiProperty({ type: [QuoteItemResponseDto] })
  items!: QuoteItemResponseDto[];

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;
}
