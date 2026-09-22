import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { trimNullableString, trimString } from './inventory-input.transforms';

export class CreateInventoryCategoryDto {
  @ApiProperty({
    example: 'Brakes',
    minLength: 1,
    maxLength: 120,
    description: 'Unique within the workshop.',
  })
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ maxLength: 500, nullable: true, type: String })
  @Transform(trimNullableString)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;
}
