import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

export class MeUserResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Ada Lovelace' })
  name!: string;

  @ApiProperty({ example: 'ada@example.com' })
  email!: string;
}

export class MeProfileResponseDto {
  @ApiProperty({ example: 'Ada' })
  displayName!: string;

  @ApiProperty({ example: '+54 11 5555 5555', nullable: true })
  phone!: string | null;

  @ApiProperty({ example: 'Garage Street 1', nullable: true })
  address!: string | null;
}

export class MeActiveWorkshopResponseDto {
  @ApiProperty({ format: 'uuid' })
  workshopId!: string;

  @ApiProperty({ format: 'uuid' })
  membershipId!: string;

  @ApiProperty({ example: 'RacerLab' })
  name!: string;

  @ApiProperty({ enum: UserRole, example: UserRole.OWNER })
  role!: UserRole;

  @ApiProperty({ type: MeProfileResponseDto })
  profile!: MeProfileResponseDto;
}

export class MeResponseDto {
  @ApiProperty({ type: MeUserResponseDto })
  user!: MeUserResponseDto;

  @ApiProperty({ type: MeActiveWorkshopResponseDto, nullable: true })
  activeWorkshop!: MeActiveWorkshopResponseDto | null;

  @ApiProperty({ example: false })
  requiresPasswordChange!: boolean;
}
