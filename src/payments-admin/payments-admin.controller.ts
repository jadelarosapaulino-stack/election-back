import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { Auth } from '../auth/decorators';
import { ValidRoles } from '../auth/interfaces';
import { PaymentsAdminService } from './payments-admin.service';

@Controller('payments/admin')
@Auth(ValidRoles.admin)
export class PaymentsAdminController {
  constructor(private readonly paymentsAdminService: PaymentsAdminService) {}

  @Get('prices')
  listPrices() {
    return this.paymentsAdminService.listPrices();
  }

  @Post('prices')
  upsertPrice(@Body() payload: Record<string, unknown>) {
    return this.paymentsAdminService.upsertPrice(payload);
  }

  @Patch('prices/order')
  reorderPrices(@Body() payload: { priceIds: string[] }) {
    return this.paymentsAdminService.reorderPrices(payload);
  }

  @Delete('prices/:priceId')
  deactivatePrice(@Param('priceId') priceId: string) {
    return this.paymentsAdminService.deactivatePrice(priceId);
  }
}
