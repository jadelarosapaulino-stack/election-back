import { Body, Controller, Post } from '@nestjs/common';
import { PlanPurchasesService } from './plan-purchases.service';
import { RecordPlanPurchaseDto } from './dto/record-plan-purchase.dto';

@Controller('billing')
export class PlanPurchasesController {
  constructor(private readonly purchasesService: PlanPurchasesService) {}

  @Post('purchases/stripe')
  recordStripePurchase(@Body() dto: RecordPlanPurchaseDto) {
    return this.purchasesService.recordFromStripe(dto);
  }
}
