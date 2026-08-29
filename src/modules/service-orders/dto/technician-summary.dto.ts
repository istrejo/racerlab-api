import { ApiProperty } from '@nestjs/swagger';

export class TechnicianSummaryDto {
  @ApiProperty({ format: 'uuid', description: 'Workshop membership UUID.' })
  membershipId!: string;

  @ApiProperty({ format: 'uuid', description: 'User UUID.' })
  userId!: string;

  @ApiProperty({ example: 'Ana Pérez' })
  displayName!: string;
}
