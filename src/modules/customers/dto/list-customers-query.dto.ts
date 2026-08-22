import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { trimString } from './customer-input.transforms';

export enum CustomerSort {
  NAME_ASC = 'NAME_ASC',
  NAME_DESC = 'NAME_DESC',
  NEWEST = 'NEWEST',
  OLDEST = 'OLDEST',
}

function optionalBoolean({ value }: { value: unknown }): unknown {
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return value;
}

export class ListCustomersQueryDto {
  @ApiPropertyOptional({
    description:
      'Partial match against name, phone, WhatsApp, document, or email.',
    maxLength: 100,
  })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter customers by whether they have registered vehicles.',
    type: Boolean,
  })
  @Transform(optionalBoolean)
  @IsOptional()
  @IsBoolean()
  hasVehicles?: boolean;

  @ApiPropertyOptional({
    description: 'Filter customers by whether they have service orders.',
    type: Boolean,
  })
  @Transform(optionalBoolean)
  @IsOptional()
  @IsBoolean()
  hasServiceOrders?: boolean;

  @ApiPropertyOptional({ enum: CustomerSort, default: CustomerSort.NAME_ASC })
  @IsOptional()
  @IsEnum(CustomerSort)
  sort?: CustomerSort;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
