import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

export class ActiveWorkshopResponseDto {
  @ApiProperty({ format: 'uuid' })
  workshopId!: string;

  @ApiProperty({ format: 'uuid' })
  membershipId!: string;

  @ApiProperty({ example: 'Taller principal' })
  name!: string;

  @ApiProperty({ enum: UserRole, example: UserRole.OWNER })
  role!: UserRole;
}
