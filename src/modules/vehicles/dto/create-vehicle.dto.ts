import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  normalizePlate,
  trimNullableString,
  trimString,
} from './vehicle-input.transforms';

export class CreateVehicleDto {
  @ApiProperty({ example: 'ABC1234', minLength: 1, maxLength: 20 })
  @Transform(normalizePlate)
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  plate!: string;

  @ApiProperty({ example: 'Toyota', minLength: 1, maxLength: 80 })
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  brand!: string;

  @ApiProperty({ example: 'Corolla', minLength: 1, maxLength: 80 })
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  model!: string;

  @ApiPropertyOptional({ example: 2019, minimum: 1900, maximum: 2200, nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(2200)
  year?: number | null;

  @ApiPropertyOptional({ example: 'Blanco', maxLength: 50, nullable: true })
  @Transform(trimNullableString)
  @IsOptional()
  @IsString()
  @MaxLength(50)
  color?: string | null;

  @ApiPropertyOptional({ example: '1HGCM82633A123456', maxLength: 17, nullable: true })
  @Transform(trimNullableString)
  @IsOptional()
  @IsString()
  @MaxLength(17)
  vin?: string | null;

  @ApiPropertyOptional({ example: 45000, minimum: 0, nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  mileage?: number | null;

  @ApiPropertyOptional({ example: 'Sedán', maxLength: 50, nullable: true })
  @Transform(trimNullableString)
  @IsOptional()
  @IsString()
  @MaxLength(50)
  vehicleType?: string | null;

  @ApiPropertyOptional({ maxLength: 2000, nullable: true })
  @Transform(trimNullableString)
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}
