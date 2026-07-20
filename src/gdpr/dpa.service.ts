import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DpaRecord } from './dpa-record.entity';

@Injectable()
export class DpaService {
  constructor(
    @InjectRepository(DpaRecord)
    private readonly repo: Repository<DpaRecord>,
  ) {}

  async findAll(): Promise<DpaRecord[]> {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<DpaRecord | null> {
    return this.repo.findOneBy({ id });
  }

  async create(data: Partial<DpaRecord>): Promise<DpaRecord> {
    const record = this.repo.create(data);
    return this.repo.save(record);
  }

  async update(id: string, data: Partial<DpaRecord>): Promise<DpaRecord | null> {
    await this.repo.update(id, data);
    return this.repo.findOneBy({ id });
  }
}
