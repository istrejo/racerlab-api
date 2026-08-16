import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { QuoteItemType } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { trimString } from '../../service-orders/dto/service-order-input.transforms';

export class QuoteItemInputDto {
  @ApiProperty({ enum: QuoteItemType, description: 'Line item type.' })
  @IsEnum(QuoteItemType)
  type!: QuoteItemType;

  @ApiProperty({ example: 'Pastillas de freno delanteras', minLength: 1, maxLength: 1000 })
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  description!: string;

  @ApiProperty({ example: 2, description: 'Quantity with up to 3 decimal places.' })
  @IsNumber({ maxDecimalPlaces: 3 })
  @IsPositive()
  @Max(999999)
  quantity!: number;

  @ApiProperty({ example: 45.5, description: 'Unit price with up to 2 decimal places.' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9999999999)
  unitPrice!: number;

  @ApiPropertyOptional({ nullable: true, example: 30, description: 'Internal cost price.' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9999999999)
  costPrice?: number | null;
}
