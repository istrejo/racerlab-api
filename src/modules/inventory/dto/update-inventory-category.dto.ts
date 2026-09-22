import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateInventoryCategoryDto } from './create-inventory-category.dto';

export class UpdateInventoryCategoryDto extends PartialType(
  CreateInventoryCategoryDto,
) {
  @ApiPropertyOptional({
    description:
      'Set to false to deactivate the category. There is no hard delete.',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
