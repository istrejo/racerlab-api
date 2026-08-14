import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FuelLevel, ServiceOrderPriority } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { trimNullableString } from './service-order-input.transforms';

export class CreateServiceOrderDto {
  @ApiProperty({ format: 'uuid', description: 'Customer who owns the vehicle.' })
  @IsUUID()
  customerId!: string;

  @ApiProperty({ format: 'uuid', description: 'Vehicle to be serviced.' })
  @IsUUID()
  vehicleId!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Initial technician assignment (membership UUID).',
  })
  @IsOptional()
  @IsUUID()
  technicianId?: string | null;

  @ApiPropertyOptional({
    enum: ServiceOrderPriority,
    default: ServiceOrderPriority.NORMAL,
    nullable: true,
  })
  @IsOptional()
  @IsEnum(ServiceOrderPriority)
  priority?: ServiceOrderPriority | null;

  @ApiPropertyOptional({
    example: 'Ruido al frenar, aceite con fugas',
    maxLength: 5000,
    nullable: true,
  })
  @Transform(trimNullableString)
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  reportedIssues?: string | null;

  @ApiPropertyOptional({ maxLength: 5000, nullable: true })
  @Transform(trimNullableString)
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  receptionNotes?: string | null;

  @ApiPropertyOptional({ example: 45000, minimum: 0, nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  mileageIn?: number | null;

  @ApiPropertyOptional({ enum: FuelLevel, nullable: true })
  @IsOptional()
  @IsEnum(FuelLevel)
  fuelLevel?: FuelLevel | null;

  @ApiPropertyOptional({
    example: '2026-09-01',
    description: 'ISO date string (YYYY-MM-DD).',
    nullable: true,
  })
  @IsOptional()
  @IsDateString()
  estimatedDeliveryDate?: string | null;
}
