import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Aes256GcmService } from 'src/common/security/aes-256-gcm.service';
import { Vote } from './entities/vote.entity';

@Injectable()
export class VoteEncryptionBackfillService implements OnApplicationBootstrap {
  private readonly logger = new Logger(VoteEncryptionBackfillService.name);

  constructor(
    @InjectRepository(Vote)
    private readonly votes: Repository<Vote>,
    private readonly aes: Aes256GcmService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const legacyVotes = await this.votes.find({
      where: { encryptedPayload: null },
      relations: ['voter', 'option', 'option.question', 'option.question.election'],
      take: 500,
    });

    if (!legacyVotes.length) return;

    for (const vote of legacyVotes) {
      const encryptedPayload = this.aes.encryptJson({
        voterId: vote.voter?.id || null,
        optionId: vote.option?.id || null,
        electionId: vote.option?.question?.election?.id || null,
        isDemo: vote.isDemo,
        castAt: vote.votedAt?.toISOString?.() || null,
        migratedAt: new Date().toISOString(),
      });

      vote.encryptionAlg = encryptedPayload.alg;
      vote.encryptedPayload = JSON.stringify(encryptedPayload);
    }

    await this.votes.save(legacyVotes);
    this.logger.log(`Encrypted ${legacyVotes.length} legacy vote record(s) with AES-256-GCM.`);
  }
}
