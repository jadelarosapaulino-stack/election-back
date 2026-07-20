import { Body, Controller, Get, Put } from '@nestjs/common';
import { PricingConfigService } from './pricing-config.service';
import { UpdatePricingConfigDto } from './dto/update-pricing-config.dto';
import { Auth } from '../auth/decorators';
import { ValidRoles } from '../auth/interfaces';

@Controller('pricing')
export class PricingConfigController {
  constructor(private readonly pricingConfigService: PricingConfigService) {}

  @Get('public/enterprise')
  getPublicEnterprisePricing() {
    return this.pricingConfigService.getPublicEnterprisePricing();
  }

  @Put('admin/enterprise')
  @Auth(ValidRoles.admin)
  updateConfig(@Body() dto: UpdatePricingConfigDto) {
    return this.pricingConfigService.updateConfig(dto);
  }
}
