import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InventoryMovementType } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { trimNullableString } from './inventory-input.transforms';
import { MAX_QUANTITY } from './inventory-limits';

/**
 * Movement types a client may record manually. RESERVATION and RELEASE are
 * written only by the server as part of the quote-approval workflow.
 */
export const CLIENT_MOVEMENT_TYPES = [
  InventoryMovementType.INBOUND,
  InventoryMovementType.OUTBOUND,
  InventoryMovementType.RETURN,
  InventoryMovementType.ADJUSTMENT,
] as const;

export type ClientMovementType = (typeof CLIENT_MOVEMENT_TYPES)[number];

export class CreateInventoryMovementDto {
  @ApiProperty({
    enum: CLIENT_MOVEMENT_TYPES,
    description:
      'INBOUND and RETURN add `quantity`; OUTBOUND subtracts `quantity`; ADJUSTMENT sets the stock to `countedStock`.',
  })
  @IsIn(CLIENT_MOVEMENT_TYPES)
  type!: ClientMovementType;

  @ApiPropertyOptional({
    example: 2,
    exclusiveMinimum: true,
    minimum: 0,
    maximum: MAX_QUANTITY,
    description:
      'Required for INBOUND, OUTBOUND, and RETURN; forbidden for ADJUSTMENT. Up to 3 decimal places.',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @IsPositive()
  @Max(MAX_QUANTITY)
  quantity?: number;

  @ApiPropertyOptional({
    example: 7,
    minimum: 0,
    maximum: MAX_QUANTITY,
    description:
      'Physical count. Required for ADJUSTMENT; forbidden otherwise. Up to 3 decimal places.',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  @Max(MAX_QUANTITY)
  countedStock?: number;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Service order of the same workshop that consumed (OUTBOUND) or returned (RETURN) the stock.',
  })
  @IsOptional()
  @IsUUID()
  serviceOrderId?: string;

  @ApiPropertyOptional({ maxLength: 500, nullable: true, type: String })
  @Transform(trimNullableString)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}
