import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class SelectWorkshopDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  workshopId!: string;
}
