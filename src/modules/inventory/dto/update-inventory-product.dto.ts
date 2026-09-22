import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateInventoryProductDto } from './create-inventory-product.dto';

/** Stock is intentionally absent: it only changes through inventory movements. */
export class UpdateInventoryProductDto extends PartialType(
  OmitType(CreateInventoryProductDto, ['initialStock'] as const),
) {
  @ApiPropertyOptional({
    description:
      'Set to false to deactivate the product. There is no hard delete.',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
