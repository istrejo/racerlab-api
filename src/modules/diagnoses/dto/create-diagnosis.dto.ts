import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const trimNullable = ({ value }: { value: unknown }): string | null => {
  const trimmed = typeof value === 'string' ? value.trim() : value;
  return (trimmed as string) || null;
};

export class CreateDiagnosisDto {
  @ApiProperty({ example: 'Pastillas de freno desgastadas al 10%.', minLength: 1, maxLength: 10000 })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  description!: string;

  @ApiPropertyOptional({ maxLength: 5000, nullable: true })
  @Transform(trimNullable)
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  requiredPartsNotes?: string | null;

  @ApiPropertyOptional({ maxLength: 5000, nullable: true })
  @Transform(trimNullable)
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  suggestedLabor?: string | null;
}
