import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { QuoteApprovalMethod, QuoteStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { trimNullableString } from '../../service-orders/dto/service-order-input.transforms';

export class ChangeQuoteStatusDto {
  @ApiProperty({ enum: QuoteStatus, description: 'Target status for the transition.' })
  @IsEnum(QuoteStatus)
  status!: QuoteStatus;

  @ApiPropertyOptional({
    enum: QuoteApprovalMethod,
    nullable: true,
    example: QuoteApprovalMethod.WHATSAPP,
    description: 'How the customer approved or rejected. Required for APPROVED and REJECTED.',
  })
  @IsOptional()
  @IsEnum(QuoteApprovalMethod)
  approvalMethod?: QuoteApprovalMethod | null;

  @ApiPropertyOptional({
    nullable: true,
    maxLength: 200,
    example: 'Reference 4821, approved by the vehicle owner.',
    description: 'Free-text detail supporting the approval method.',
  })
  @Transform(trimNullableString)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  approvalMethodDetail?: string | null;
}
