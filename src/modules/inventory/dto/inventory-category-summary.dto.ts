import { ApiProperty } from '@nestjs/swagger';

export class InventoryCategorySummaryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Brakes' })
  name!: string;

  @ApiProperty()
  isActive!: boolean;
}
