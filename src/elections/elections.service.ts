import { BadRequestException, forwardRef, Inject, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { CreateElectionDto } from './dto/create-election.dto';
import { UpdateElectionDto } from './dto/update-election.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Election } from './entities/election.entity';
import { DataSource, Repository } from 'typeorm';
import { User } from 'src/auth/entities/user.entity';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { isUUID } from 'class-validator';
import { VotersService } from 'src/voters/voters.service';
import { Voter } from 'src/voters/entities/voter.entity';
import { QuestionsService } from 'src/questions/questions.service';

@Injectable()
export class ElectionsService {

  private readonly logger = new Logger('ElectionService');
  
    constructor(
      @InjectRepository(Election)
      private readonly electionRepository: Repository<Election>,
      private readonly dataSource: DataSource,
      @Inject(forwardRef(() => VotersService))
      private readonly votersService: VotersService,
       @Inject(forwardRef(() => QuestionsService))
      private readonly questionsService: QuestionsService
    ) {}

  async create(createElectionDto: CreateElectionDto, user: User) {
    try {
          const { ...electionDetails } = createElectionDto;
    
          const election = this.electionRepository.create({
            ...electionDetails,
            user: user,
            questions: [],
            // images: images.map(image =>
            //   this.electionImageRepository.create({ url: image }))
          });
          await this.electionRepository.save(election);

          return {...election};
        } catch (error) {
          this.handleDBExceptions(error);
        }
    return 'This action adds a new election';
  }

  async findAll(paginationDto: PaginationDto, user: User) {
     try {
      const { limit = 10, offset = 0 } = paginationDto;
      const elections = await this.electionRepository.find({
        take: limit,
        skip: offset,
        // relations: {
        //   questions: true,
        // }
        order: {
          createdAt: 'DESC',
        }
      });
      return elections.map(({questions, ...rest}) => ({
        ...rest,
        // images: images.map( img => img.url),
        // questions: questions.map( q => q.title)
      }));
      
    } catch (error) {
      this.handleDBExceptions(error);
    }
  }

  async findOne(term: string, user: User) {
    term = term.toLowerCase();
    let election: Election;

    if (isUUID(term)) {
      election = await this.electionRepository.findOneBy({ id: term, user });

    } else {
      const queryBuilder = this.electionRepository.createQueryBuilder('elect');

      election = await queryBuilder
        .where('LOWER(title)=:title or id=:id', {
          title: term,
          id: term,
        })
        .getOne();
    }

    let paginationDto: PaginationDto = {
    limit: 10,
    offset: 0,
    ordertype: 'DESC',
    search: ''
  }

    const voters = await this.votersService.findAll(election.id, paginationDto);
    const questions =  await this.questionsService.questionsCountOfElection(election.id, user);

    const result: any = { 
      election: election,
      voters: voters,
      questionsCount: questions || 0
    }

    if (!election) throw new NotFoundException(`Election with ${term} not fount`);

    return result;
  }

  async update(id: string, updateElectionDto: UpdateElectionDto, user: User) {
     const { ...toUpdate } = updateElectionDto
        const election = await this.electionRepository.preload({
          id: id,
          user,
          ...toUpdate,
          questions: []
        });
    
        if (!election)
          throw new NotFoundException(`Election with id: ${id} not fount`);
    
        //Create queryRunner
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
    
        try {
    
          // if ( images ) {
          //   await queryRunner.manager.delete( ElectionImgs, { election: { id }});
          //   // election.images = images.map( image => this.electionImageRepository.create({url: image}))
          // }
    
          await queryRunner.manager.save(election);
          await queryRunner.commitTransaction();
          await queryRunner.release();
    
          // await this.productRepository.save(product);
          return election;
        } catch (error) {
          await queryRunner.rollbackTransaction();
          await queryRunner.release();
          this.handleDBExceptions(error);
        }
  }

  async remove(id: string, user: User) {
    const election = await this.findOne(id, user);
    await this.electionRepository.remove(election);
  }

  private handleDBExceptions(error: any) {
      if (error.code == '20505') throw new BadRequestException(error.detail);
  
      this.logger.error(error);
      throw new InternalServerErrorException(error.detail);
    }
}
