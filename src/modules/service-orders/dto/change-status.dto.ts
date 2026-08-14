import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ServiceOrderStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { trimNullableString } from './service-order-input.transforms';

export class ChangeStatusDto {
  @ApiProperty({
    enum: ServiceOrderStatus,
    description: 'Target status for the transition.',
  })
  @IsEnum(ServiceOrderStatus)
  status!: ServiceOrderStatus;

  @ApiPropertyOptional({ maxLength: 2000, nullable: true })
  @Transform(trimNullableString)
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string | null;
}
