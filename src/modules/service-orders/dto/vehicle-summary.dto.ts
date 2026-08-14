import { ApiProperty } from '@nestjs/swagger';

export class VehicleSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'ABC1234' })
  plate!: string;

  @ApiProperty({ example: 'Toyota' })
  brand!: string;

  @ApiProperty({ example: 'Corolla' })
  model!: string;
}
