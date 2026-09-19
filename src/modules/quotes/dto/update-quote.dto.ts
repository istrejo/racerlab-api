import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { IsIsoCurrencyCode, normalizeCurrencyCode } from './currency-code';
import { QuoteItemInputDto } from './quote-item-input.dto';

export class UpdateQuoteDto {
  @ApiPropertyOptional({ type: [QuoteItemInputDto], minItems: 1 })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => QuoteItemInputDto)
  items?: QuoteItemInputDto[];

  @ApiPropertyOptional({
    example: 'EUR',
    minLength: 3,
    maxLength: 3,
    description: 'ISO 4217 currency code.',
  })
  @Transform(normalizeCurrencyCode)
  @IsOptional()
  @IsIsoCurrencyCode()
  currencyCode?: string;

  @ApiPropertyOptional({
    nullable: true,
    example: 10,
    description: 'Absolute discount amount.',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9999999999)
  discount?: number | null;

  @ApiPropertyOptional({
    nullable: true,
    example: 15.2,
    description: 'Absolute tax amount.',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9999999999)
  tax?: number | null;
}
