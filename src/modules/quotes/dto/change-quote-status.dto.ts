import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { QuoteApprovalMethod, QuoteStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { trimNullableString } from '../../service-orders/dto/service-order-input.transforms';

/**
 * `DRAFT` is only ever the initial state and `SUPERSEDED` is assigned by the
 * service when a newer version is activated, so neither is client-assignable.
 */
export const CLIENT_ASSIGNABLE_QUOTE_STATUSES = [
  QuoteStatus.ACTIVE,
  QuoteStatus.APPROVED,
  QuoteStatus.REJECTED,
  QuoteStatus.EXPIRED,
  QuoteStatus.CANCELLED,
] as const;

export type ClientAssignableQuoteStatus =
  (typeof CLIENT_ASSIGNABLE_QUOTE_STATUSES)[number];

export class ChangeQuoteStatusDto {
  @ApiProperty({
    enum: CLIENT_ASSIGNABLE_QUOTE_STATUSES,
    description:
      'Target status for the transition. SUPERSEDED is assigned by the server only.',
  })
  @IsIn(CLIENT_ASSIGNABLE_QUOTE_STATUSES)
  status!: ClientAssignableQuoteStatus;

  @ApiPropertyOptional({
    enum: QuoteApprovalMethod,
    nullable: true,
    example: QuoteApprovalMethod.WHATSAPP,
    description:
      'How the customer approved or rejected. Required for APPROVED and REJECTED.',
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
