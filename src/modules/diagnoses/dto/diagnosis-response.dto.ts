import { ApiProperty } from '@nestjs/swagger';
import { MemberSummaryDto } from '../../service-orders/dto/member-summary.dto';

export class DiagnosisResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  serviceOrderId!: string;

  @ApiProperty({ type: MemberSummaryDto })
  technician!: MemberSummaryDto;

  @ApiProperty({ example: 'Pastillas de freno desgastadas al 10%.' })
  description!: string;

  @ApiProperty({ nullable: true, type: String })
  requiredPartsNotes!: string | null;

  @ApiProperty({ nullable: true, type: String })
  suggestedLabor!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;
}
