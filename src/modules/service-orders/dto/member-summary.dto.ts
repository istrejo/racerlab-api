import { ApiProperty } from '@nestjs/swagger';

export class MemberSummaryDto {
  @ApiProperty({ format: 'uuid', description: 'User UUID.' })
  userId!: string;

  @ApiProperty({ example: 'Juan Pérez' })
  displayName!: string;
}
