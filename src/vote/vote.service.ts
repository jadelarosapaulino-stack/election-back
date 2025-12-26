import { CastVoteDto } from "./dto/create-vote.dto";
import { Repository } from "typeorm";
import { Options } from "src/options/entities/option.entity";
import { Vote } from "./entities/vote.entity";
import { InjectRepository } from "@nestjs/typeorm";
import { BadRequestException, Injectable } from "@nestjs/common";
import { TimelineService } from "src/timeline/timeline.service";

@Injectable()
export class VoteService {
  constructor(
    @InjectRepository(Vote)
        private readonly _voterRepository: Repository<Vote>,
    @InjectRepository(Options) private optionRepo: Repository<Options>,
    private timeline: TimelineService, // MongoDB
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

    const vote = this._voterRepository.create({
      voter: { id: dto.voterId },
      option: option,
    });
    const savedVote = await this._voterRepository.save(vote);

    // Registrar en MongoDB
    await this.timeline.logAction({
      entityId: dto.voterId.toString(),
      electionId: option.election.id.toString(),
      action: 'voted',
      metadata: { optionId: dto.optionId },
    });

    return savedVote;
  }
}
