import { ApiProperty } from '@nestjs/swagger';

export class VehicleResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  customerId!: string;

  @ApiProperty({ example: 'ABC1234' })
  plate!: string;

  @ApiProperty({ example: 'Toyota' })
  brand!: string;

  @ApiProperty({ example: 'Corolla' })
  model!: string;

  @ApiProperty({ nullable: true, type: Number, example: 2019 })
  year!: number | null;

  @ApiProperty({ nullable: true, type: String, example: 'Blanco' })
  color!: string | null;

  @ApiProperty({ nullable: true, type: String, example: '1HGCM82633A123456' })
  vin!: string | null;

  @ApiProperty({ nullable: true, type: Number, example: 45000 })
  mileage!: number | null;

  @ApiProperty({ nullable: true, type: String, example: 'Sedán' })
  vehicleType!: string | null;

  @ApiProperty({ nullable: true, type: String })
  notes!: string | null;

  @ApiProperty({ minimum: 0 })
  serviceOrderCount!: number;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;
}
