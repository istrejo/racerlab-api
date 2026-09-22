import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProductUnit } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { trimNullableString, trimString } from './inventory-input.transforms';
import { MAX_MONEY, MAX_QUANTITY } from './inventory-limits';

export class CreateInventoryProductDto {
  @ApiProperty({ example: 'Brake pads (front)', minLength: 1, maxLength: 160 })
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name!: string;

  @ApiPropertyOptional({
    example: 'BP-001',
    maxLength: 64,
    nullable: true,
    type: String,
    description: 'Unique within the workshop when present.',
  })
  @Transform(trimNullableString)
  @IsOptional()
  @IsString()
  @MaxLength(64)
  sku?: string | null;

  @ApiPropertyOptional({
    example: 'Brembo',
    maxLength: 80,
    nullable: true,
    type: String,
  })
  @Transform(trimNullableString)
  @IsOptional()
  @IsString()
  @MaxLength(80)
  brand?: string | null;

  @ApiPropertyOptional({ maxLength: 2000, nullable: true, type: String })
  @Transform(trimNullableString)
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiProperty({ enum: ProductUnit })
  @IsEnum(ProductUnit)
  unit!: ProductUnit;

  @ApiPropertyOptional({
    example: 30.5,
    nullable: true,
    type: Number,
    minimum: 0,
    maximum: MAX_MONEY,
    description: 'Internal cost price with up to 2 decimal places.',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_MONEY)
  costPrice?: number | null;

  @ApiPropertyOptional({
    example: 45,
    nullable: true,
    type: Number,
    minimum: 0,
    maximum: MAX_MONEY,
    description: 'Sale price with up to 2 decimal places.',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_MONEY)
  salePrice?: number | null;

  @ApiPropertyOptional({
    example: 5,
    nullable: true,
    type: Number,
    minimum: 0,
    maximum: MAX_QUANTITY,
    description:
      'Low-stock threshold with up to 3 decimal places. Null disables low-stock alerts.',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  @Max(MAX_QUANTITY)
  minimumStock?: number | null;

  @ApiPropertyOptional({
    example: 'Shelf A-1',
    maxLength: 120,
    nullable: true,
    type: String,
  })
  @Transform(trimNullableString)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  location?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    type: String,
    description: 'Active category of the same workshop.',
  })
  @IsOptional()
  @IsUUID()
  categoryId?: string | null;

  @ApiPropertyOptional({
    example: 10,
    minimum: 0,
    maximum: MAX_QUANTITY,
    description:
      'Opening stock with up to 3 decimal places. A positive value is recorded as an INBOUND movement.',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  @Max(MAX_QUANTITY)
  initialStock?: number;
}
