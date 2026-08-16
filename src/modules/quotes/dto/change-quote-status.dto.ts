import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { QuoteStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { trimNullableString } from '../../service-orders/dto/service-order-input.transforms';

export class ChangeQuoteStatusDto {
  @ApiProperty({ enum: QuoteStatus, description: 'Target status for the transition.' })
  @IsEnum(QuoteStatus)
  status!: QuoteStatus;

  @ApiPropertyOptional({
    nullable: true,
    maxLength: 200,
    example: 'WHATSAPP',
    description: 'How the customer approved or rejected. Required for APPROVED and REJECTED.',
  })
  @Transform(trimNullableString)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  approvalMethod?: string | null;
}
