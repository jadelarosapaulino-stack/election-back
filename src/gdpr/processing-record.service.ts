import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProcessingRecord } from './processing-record.entity';

@Injectable()
export class ProcessingRecordService {
  constructor(
    @InjectRepository(ProcessingRecord)
    private readonly repo: Repository<ProcessingRecord>,
  ) {}

  async findAll(): Promise<ProcessingRecord[]> {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<ProcessingRecord | null> {
    return this.repo.findOneBy({ id });
  }

  async create(data: Partial<ProcessingRecord>): Promise<ProcessingRecord> {
    const record = this.repo.create(data);
    return this.repo.save(record);
  }

  async update(id: string, data: Partial<ProcessingRecord>): Promise<ProcessingRecord | null> {
    await this.repo.update(id, data);
    return this.repo.findOneBy({ id });
  }
}
