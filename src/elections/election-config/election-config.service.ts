import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ElectionConfig } from './entities/election-config.entity';
import { User } from 'src/auth/entities/user.entity';

@Injectable()
export class ElectionConfigService {
  constructor(
    @InjectRepository(ElectionConfig)
    private readonly configRepo: Repository<ElectionConfig>,
  ) {}

  async findOne(electionId: string, user: User): Promise<ElectionConfig> {
    const config = await this.configRepo.findOne({
      where: { electionId, userId: user.id },
    });

    if (!config) {
      throw new NotFoundException(
        `Config not found for election`,
      );
    }
    return config;
  }

  getElectionStatus(config: ElectionConfig): 'PENDING' | 'STARTED' | 'ENDED' {
    const now = new Date();

    if (config.startAt && now < config.startAt) return 'PENDING';
    if (config.endAt && now > config.endAt) return 'ENDED';
    return 'STARTED';
  }

  async updateConfig(
    electionId: string,
    user: User,
    data: Partial<ElectionConfig>,
  ): Promise<ElectionConfig> {
    const config = await this.findOne(electionId, user);
    Object.assign(config, data);
    return this.configRepo.save(config);
  }

  async createConfig(data: Partial<ElectionConfig>): Promise<ElectionConfig> {
    const config = this.configRepo.create(data);
    return this.configRepo.save(config);
  }
}
