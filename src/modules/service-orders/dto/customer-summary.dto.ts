import { ApiProperty } from '@nestjs/swagger';

export class CustomerSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'María García' })
  fullName!: string;
}
