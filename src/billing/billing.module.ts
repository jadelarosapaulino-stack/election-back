import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlanPurchase } from './entities/plan-purchase.entity';
import { PlanPurchasesController } from './plan-purchases.controller';
import { PlanPurchasesService } from './plan-purchases.service';

@Module({
  imports: [TypeOrmModule.forFeature([PlanPurchase])],
  controllers: [PlanPurchasesController],
  providers: [PlanPurchasesService],
  exports: [PlanPurchasesService, TypeOrmModule],
})
export class BillingModule {}
