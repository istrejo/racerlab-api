import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class AssignTechnicianDto {
  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Membership UUID of the technician to assign. Pass null to unassign.',
  })
  @IsOptional()
  @IsUUID()
  technicianId?: string | null;
}
