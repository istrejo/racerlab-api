import { ApiProperty } from '@nestjs/swagger';

export class InventoryCategoryResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Brakes' })
  name!: string;

  @ApiProperty({ nullable: true, type: String })
  description!: string | null;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty({
    minimum: 0,
    description: 'Number of products (active or not) in the category.',
  })
  productCount!: number;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;
}
