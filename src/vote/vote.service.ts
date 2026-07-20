import { CastVoteDto } from "./dto/create-vote.dto";
import { Repository } from "typeorm";
import { Options } from "src/options/entities/option.entity";
import { Vote } from "./entities/vote.entity";
import { InjectRepository } from "@nestjs/typeorm";
import { BadRequestException, Injectable } from "@nestjs/common";
import { TimelineService } from "src/timeline/timeline.service";
import { TimelineAction } from "src/timeline/timeline.enum";
import { RealtimeGateway } from "src/realtime/realtime.gateway";
import { Aes256GcmService } from "src/common/security/aes-256-gcm.service";

@Injectable()
export class VoteService {
  constructor(
    @InjectRepository(Vote)
        private readonly _voterRepository: Repository<Vote>,
    @InjectRepository(Options) private optionRepo: Repository<Options>,
    private timeline: TimelineService, // MongoDB
    private realtime: RealtimeGateway,
    private readonly aes: Aes256GcmService,
  ) {}

  async castVote(dto: CastVoteDto) {
    // Validar si ya votó en esta elección
    const existingVote = await this._voterRepository
      .createQueryBuilder('vote')
      .innerJoin('vote.option', 'option')
      .where('vote.voter = :voterId', { voterId: dto.voterId })
      .andWhere('option.electionId = (SELECT electionId FROM option WHERE id = :optionId)', { optionId: dto.optionId })
      .getOne();

    if (existingVote) {
      throw new BadRequestException('Ya has votado en esta elección.');
    }

    const option = await this.optionRepo.findOne({
      where: { id: dto.optionId },
      relations: ['election'],
    });

    const encryptedPayload = this.aes.encryptJson({
      voterId: dto.voterId,
      optionId: dto.optionId,
      electionId: option?.election?.id,
      isDemo: false,
      castAt: new Date().toISOString(),
    });

    const vote = this._voterRepository.create({
      voter: { id: dto.voterId },
      option: option,
      encryptionAlg: encryptedPayload.alg,
      encryptedPayload: JSON.stringify(encryptedPayload),
    });
    const savedVote = await this._voterRepository.save(vote);

    // Registrar en MongoDB
    const deviceType =
      dto?.metadata?.deviceType ||
      dto?.metadata?.device?.type ||
      dto?.metadata?.meta?.deviceType ||
      null;
    const deviceModel =
      dto?.metadata?.deviceModel ||
      dto?.metadata?.device?.model ||
      dto?.metadata?.meta?.deviceModel ||
      null;
    const devicePlatform =
      dto?.metadata?.devicePlatform ||
      dto?.metadata?.device?.platform ||
      dto?.metadata?.meta?.devicePlatform ||
      null;
    const deviceBrands =
      dto?.metadata?.deviceBrands ||
      dto?.metadata?.device?.brands ||
      dto?.metadata?.meta?.deviceBrands ||
      null;
    const coords =
      dto.collectLocation === true
        ? (dto?.metadata?.coords || dto?.metadata?.meta?.coords || null)
        : null;

    await this.timeline.logAction({
      entityId: dto.voterId.toString(),
      electionId: option.election.id.toString(),
      action: TimelineAction.VOTE_CAST,
      metadata: {
        optionId: dto.optionId,
        deviceType,
        deviceModel,
        devicePlatform,
        deviceBrands,
        coords,
      },
    });

    if (option?.election?.id) {
      this.realtime.emitVoteCast(option.election.id.toString());
    }

    return savedVote;
  }
}
