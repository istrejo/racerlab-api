import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  normalizeEmailInput,
  trimNullableString,
  trimString,
} from './customer-input.transforms';

export class CreateCustomerDto {
  @ApiProperty({ example: 'Ana García', minLength: 1, maxLength: 120 })
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  fullName!: string;

  @ApiPropertyOptional({
    example: '+34 600 123 456',
    maxLength: 32,
    nullable: true,
  })
  @Transform(trimNullableString)
  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string | null;

  @ApiPropertyOptional({
    example: '+34 600 123 456',
    maxLength: 32,
    nullable: true,
  })
  @Transform(trimNullableString)
  @IsOptional()
  @IsString()
  @MaxLength(32)
  whatsapp?: string | null;

  @ApiPropertyOptional({
    example: 'ana@example.com',
    maxLength: 254,
    nullable: true,
  })
  @Transform(normalizeEmailInput)
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string | null;

  @ApiPropertyOptional({ example: '12345678-Z', maxLength: 64, nullable: true })
  @Transform(trimNullableString)
  @IsOptional()
  @IsString()
  @MaxLength(64)
  document?: string | null;

  @ApiPropertyOptional({ maxLength: 255, nullable: true })
  @Transform(trimNullableString)
  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string | null;

  @ApiPropertyOptional({ maxLength: 2000, nullable: true })
  @Transform(trimNullableString)
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}
