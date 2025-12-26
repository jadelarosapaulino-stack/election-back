import { Injectable, Logger } from '@nestjs/common';
import { CreateStatusDto } from './dto/create-status.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { Status } from './entities/status.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class StatusService {
  constructor(
    @InjectRepository(Status)
    private readonly _statusRepository: Repository<Status>,
  ) {}
  private readonly logger = new Logger('StatusService');

  async create(createStatusDto: CreateStatusDto) {
    const product = this._statusRepository.create({
      ...createStatusDto,
    });
    await this._statusRepository.save(product);

    return 'This action adds a new status';
  }

  async findAll() {
    try {
      const status = await this._statusRepository.find();
    return status;
    } catch (error) {
      this.logger.error(error);
      throw new Error('Error fetching status');
    }
  }
}
