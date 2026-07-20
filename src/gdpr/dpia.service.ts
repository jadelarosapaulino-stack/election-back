import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DpiaRecord } from './dpia-record.entity';

@Injectable()
export class DpiaService {
  constructor(
    @InjectRepository(DpiaRecord)
    private readonly repo: Repository<DpiaRecord>,
  ) {}

  async findAll(): Promise<DpiaRecord[]> {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<DpiaRecord | null> {
    return this.repo.findOneBy({ id });
  }

  async create(data: Partial<DpiaRecord>): Promise<DpiaRecord> {
    const record = this.repo.create(data);
    return this.repo.save(record);
  }

  async update(id: string, data: Partial<DpiaRecord>): Promise<DpiaRecord | null> {
    await this.repo.update(id, data);
    return this.repo.findOneBy({ id });
  }
}
