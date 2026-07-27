import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

export class WorkshopResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'RacerLab Central' })
  name!: string;

  @ApiProperty({ format: 'uuid' })
  ownerUserId!: string;

  @ApiProperty({ format: 'uuid' })
  membershipId!: string;

  @ApiProperty({ enum: UserRole })
  role!: UserRole;
}
