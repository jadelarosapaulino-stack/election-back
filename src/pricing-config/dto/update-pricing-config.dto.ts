import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdatePricingConfigDto {
  @IsNumber()
  @Min(0.0001)
  enterprisePricePerVoter!: number;

  @IsOptional()
  @IsString()
  currency?: string;
}
