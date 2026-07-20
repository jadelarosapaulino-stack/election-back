import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlanPurchase, PlanPurchaseStatus } from './entities/plan-purchase.entity';
import { RecordPlanPurchaseDto } from './dto/record-plan-purchase.dto';
import { User } from 'src/auth/entities/user.entity';
import { Election } from 'src/elections/entities/election.entity';

@Injectable()
export class PlanPurchasesService {
  constructor(
    @InjectRepository(PlanPurchase)
    private readonly purchaseRepo: Repository<PlanPurchase>
  ) {}

  async recordFromStripe(dto: RecordPlanPurchaseDto) {
    const existing = dto.stripeSessionId
      ? await this.purchaseRepo.findOne({
          where: { stripeSessionId: dto.stripeSessionId },
        })
      : null;

    const purchase = existing ?? this.purchaseRepo.create();
    purchase.planId = dto.planId;
    purchase.priceId = dto.priceId ?? purchase.priceId;
    purchase.stripeSessionId = dto.stripeSessionId ?? purchase.stripeSessionId;
    purchase.stripeEventId = dto.stripeEventId ?? purchase.stripeEventId;
    purchase.stripeCustomerId = dto.stripeCustomerId ?? purchase.stripeCustomerId;
    purchase.stripeSubscriptionId = dto.stripeSubscriptionId ?? purchase.stripeSubscriptionId;
    purchase.customerEmail = dto.customerEmail ?? purchase.customerEmail;
    purchase.amount = dto.amount ?? purchase.amount;
    purchase.currency = dto.currency ?? purchase.currency;
    purchase.capacity = dto.capacity ?? purchase.capacity;
    purchase.status = dto.status ?? purchase.status ?? PlanPurchaseStatus.PENDING;
    purchase.metadata = dto.metadata ?? purchase.metadata;

    if (dto.userId) {
      purchase.user = { id: dto.userId } as User;
    }

    if (dto.electionId) {
      purchase.election = { id: dto.electionId } as Election;
    }

    return this.purchaseRepo.save(purchase);
  }
}
