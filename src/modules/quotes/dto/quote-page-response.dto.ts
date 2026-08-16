import { ApiProperty } from '@nestjs/swagger';
import { QuoteSummaryResponseDto } from './quote-summary-response.dto';

export class QuotePageResponseDto {
  @ApiProperty({ type: [QuoteSummaryResponseDto] })
  items!: QuoteSummaryResponseDto[];

  @ApiProperty({ minimum: 1 })
  page!: number;

  @ApiProperty({ minimum: 1 })
  limit!: number;

  @ApiProperty({ minimum: 0 })
  total!: number;

  @ApiProperty({ minimum: 0 })
  totalPages!: number;
}
