import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PricingConfig } from './pricing-config.entity';
import { UpdatePricingConfigDto } from './dto/update-pricing-config.dto';

@Injectable()
export class PricingConfigService {
  constructor(
    @InjectRepository(PricingConfig)
    private readonly pricingRepo: Repository<PricingConfig>,
  ) {}

  async getConfig(): Promise<PricingConfig> {
    const configs = await this.pricingRepo.find({ take: 1, order: { createdAt: 'DESC' } });
    if (configs.length === 0) {
      const defaultConfig = this.pricingRepo.create({
        enterprisePricePerVoter: 0.1,
        currency: 'usd',
      });
      return this.pricingRepo.save(defaultConfig);
    }
    return configs[0];
  }

  async updateConfig(dto: UpdatePricingConfigDto): Promise<PricingConfig> {
    const config = await this.getConfig();
    Object.assign(config, dto);
    config.updatedAt = new Date();
    return this.pricingRepo.save(config);
  }

  async getPublicEnterprisePricing(): Promise<{ pricePerVoter: number; currency: string }> {
    const config = await this.getConfig();
    return {
      pricePerVoter: Number(config.enterprisePricePerVoter),
      currency: config.currency,
    };
  }
}
