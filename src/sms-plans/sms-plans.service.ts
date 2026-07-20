import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SmsPlan } from './entities/sms-plan.entity';
import { CreateSmsPlanDto, UpdateSmsPlanDto } from './dto/dto';

@Injectable()
export class SmsPlansService {
  constructor(
    @InjectRepository(SmsPlan)
    private readonly smsPlanRepo: Repository<SmsPlan>,
  ) {}

  async findAll(active?: boolean): Promise<SmsPlan[]> {
    const where = typeof active === 'boolean' ? { active } : {};
    return this.smsPlanRepo.find({
      where,
      order: { smsLimit: 'ASC', name: 'ASC' },
    });
  }

  async create(dto: CreateSmsPlanDto): Promise<SmsPlan> {
    await this.ensureUniqueCode(dto.code);
    const plan = this.smsPlanRepo.create({
      ...dto,
      currency: dto.currency?.toLowerCase(),
      active: dto.active ?? true,
    });
    return this.smsPlanRepo.save(plan);
  }

  async update(id: string, dto: UpdateSmsPlanDto): Promise<SmsPlan> {
    const plan = await this.smsPlanRepo.findOne({ where: { id } });
    if (!plan) {
      throw new NotFoundException('Plan no encontrado.');
    }
    if (dto.code && dto.code !== plan.code) {
      await this.ensureUniqueCode(dto.code, id);
    }
    Object.assign(plan, dto);
    if (dto.currency) {
      plan.currency = dto.currency.toLowerCase();
    }
    return this.smsPlanRepo.save(plan);
  }

  async deactivate(id: string): Promise<SmsPlan> {
    const plan = await this.smsPlanRepo.findOne({ where: { id } });
    if (!plan) {
      throw new NotFoundException('Plan no encontrado.');
    }
    plan.active = false;
    return this.smsPlanRepo.save(plan);
  }

  private async ensureUniqueCode(code: string, excludeId?: string): Promise<void> {
    const existing = await this.smsPlanRepo.findOne({ where: { code } });
    if (existing && existing.id !== excludeId) {
      throw new BadRequestException('El codigo del plan ya existe.');
    }
  }
}
