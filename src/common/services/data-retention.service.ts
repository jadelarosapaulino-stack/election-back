import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Voter } from '../../voters/entities/voter.entity';
import { User } from '../../auth/entities/user.entity';

@Injectable()
export class DataRetentionService {
  private readonly logger = new Logger(DataRetentionService.name);

  private readonly VOTER_RETENTION_DAYS = parseInt(
    process.env.VOTER_RETENTION_DAYS || '365',
    10,
  );

  constructor(
    @InjectRepository(Voter) private readonly voterRepo: Repository<Voter>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  @Cron('0 3 * * 0')
  async enforceRetention(): Promise<void> {
    this.logger.log('Starting data retention enforcement...');
    await this.anonymizeOldVoters();
    this.logger.log('Data retention enforcement complete.');
  }

  private async anonymizeOldVoters(): Promise<void> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - this.VOTER_RETENTION_DAYS);

    let processed = 0;
    for (;;) {
      const oldVoters = await this.voterRepo
        .createQueryBuilder('voter')
        .innerJoin('voter.election', 'election')
        .where('election.endDate < :cutoff', { cutoff })
        .andWhere("voter.name != 'Anonymized'")
        .limit(500)
        .getMany();

      if (oldVoters.length === 0) break;

      for (const voter of oldVoters) {
        voter.name = 'Anonymized';
        voter.email = `anonymized-${voter.id}@retention.local`;
        voter.identifier = `anon-${voter.id}`;
        if (voter.metadata) {
          voter.metadata = {};
        }
      }

      await this.voterRepo.save(oldVoters);
      processed += oldVoters.length;
      this.logger.log(`Anonymized ${processed} voter records so far...`);
    }

    if (processed > 0) {
      this.logger.log(`Total anonymized: ${processed} voter records.`);
    }
  }
}
