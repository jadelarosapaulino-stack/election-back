import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PricingConfig } from './pricing-config.entity';
import { PricingConfigService } from './pricing-config.service';
import { PricingConfigController } from './pricing-config.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PricingConfig])],
  controllers: [PricingConfigController],
  providers: [PricingConfigService],
  exports: [PricingConfigService],
})
export class PricingConfigModule {}
