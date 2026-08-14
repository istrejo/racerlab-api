import { ApiProperty } from '@nestjs/swagger';
import { FuelLevel, ServiceOrderPriority, ServiceOrderStatus } from '@prisma/client';
import { CustomerSummaryDto } from './customer-summary.dto';
import { MemberSummaryDto } from './member-summary.dto';
import { VehicleSummaryDto } from './vehicle-summary.dto';

export class ServiceOrderResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'SO-0001' })
  code!: string;

  @ApiProperty({ format: 'uuid' })
  workshopId!: string;

  @ApiProperty({ format: 'uuid' })
  customerId!: string;

  @ApiProperty({ type: CustomerSummaryDto })
  customer!: CustomerSummaryDto;

  @ApiProperty({ format: 'uuid' })
  vehicleId!: string;

  @ApiProperty({ type: VehicleSummaryDto })
  vehicle!: VehicleSummaryDto;

  @ApiProperty({ nullable: true, type: String, format: 'uuid' })
  assignedTechnicianId!: string | null;

  @ApiProperty({ nullable: true, type: MemberSummaryDto })
  assignedTechnician!: MemberSummaryDto | null;

  @ApiProperty({ enum: ServiceOrderStatus })
  status!: ServiceOrderStatus;

  @ApiProperty({ enum: ServiceOrderPriority, nullable: true, type: String })
  priority!: ServiceOrderPriority | null;

  @ApiProperty({ nullable: true, type: String })
  reportedIssues!: string | null;

  @ApiProperty({ nullable: true, type: String })
  receptionNotes!: string | null;

  @ApiProperty({ nullable: true, type: Number })
  mileageIn!: number | null;

  @ApiProperty({ enum: FuelLevel, nullable: true, type: String })
  fuelLevel!: FuelLevel | null;

  @ApiProperty({
    nullable: true,
    type: String,
    example: '2026-09-01',
    description: 'ISO date string (YYYY-MM-DD).',
  })
  estimatedDeliveryDate!: string | null;

  @ApiProperty({ minimum: 0 })
  diagnosisCount!: number;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;
}
