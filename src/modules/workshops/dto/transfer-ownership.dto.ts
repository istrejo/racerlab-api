import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class TransferOwnershipDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  membershipId!: string;
}
