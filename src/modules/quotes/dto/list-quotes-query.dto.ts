import { ApiPropertyOptional } from '@nestjs/swagger';
import { QuoteStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { trimString } from '../../service-orders/dto/service-order-input.transforms';

export class ListQuotesQueryDto {
  @ApiPropertyOptional({
    description: 'Partial match against service order code, customer name, or vehicle plate.',
    maxLength: 100,
  })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ enum: QuoteStatus, description: 'Filter by quote status.' })
  @IsOptional()
  @IsEnum(QuoteStatus)
  status?: QuoteStatus;

  @ApiPropertyOptional({ format: 'uuid', description: 'Filter by service order UUID.' })
  @IsOptional()
  @IsUUID()
  serviceOrderId?: string;

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
