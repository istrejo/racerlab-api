import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { InventoryCategoriesController } from './inventory-categories.controller';
import { InventoryCategoriesService } from './inventory-categories.service';
import { InventoryMovementsController } from './inventory-movements.controller';
import { InventoryMovementsService } from './inventory-movements.service';
import { InventoryProductsController } from './inventory-products.controller';
import { InventoryProductsService } from './inventory-products.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [
    InventoryCategoriesController,
    InventoryProductsController,
    InventoryMovementsController,
  ],
  providers: [
    InventoryCategoriesService,
    InventoryProductsService,
    InventoryMovementsService,
  ],
  exports: [
    InventoryCategoriesService,
    InventoryProductsService,
    InventoryMovementsService,
  ],
})
export class InventoryModule {}
