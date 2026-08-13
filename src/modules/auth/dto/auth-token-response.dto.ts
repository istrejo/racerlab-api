import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { ActiveWorkshopResponseDto } from './active-workshop-response.dto';
import { MeUserResponseDto } from './me-response.dto';

export class AuthTokenResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken!: string;

  @ApiProperty({ example: 'Bearer', enum: ['Bearer'] })
  tokenType!: 'Bearer';

  @ApiProperty({ type: MeUserResponseDto })
  @ValidateNested()
  @Type(() => MeUserResponseDto)
  user!: MeUserResponseDto;

  @ApiProperty({
    type: ActiveWorkshopResponseDto,
    nullable: true,
    description:
      'Current workshop context, or null while selection is required.',
  })
  @ValidateNested()
  @Type(() => ActiveWorkshopResponseDto)
  activeWorkshop!: ActiveWorkshopResponseDto | null;

  @ApiProperty({
    example: false,
    description:
      'True when the session is valid but has no active workshop context.',
  })
  requiresWorkshopSelection!: boolean;

  @ApiProperty({
    example: false,
    description:
      'True when the user must replace an administrator-issued temporary password.',
  })
  requiresPasswordChange!: boolean;
}
