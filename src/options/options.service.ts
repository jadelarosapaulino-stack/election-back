import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateOptionDto } from './dto/create-option.dto';
import { UpdateOptionDto } from './dto/update-option.dto';
import { DataSource, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Options } from './entities/option.entity';
import { TenantsService } from 'src/tenants/users-settings.service';
import { User } from 'src/auth/entities/user.entity';
import { Question } from 'src/questions/entities/question.entity';
import { StatusType } from 'src/utils/status-type.enum';

@Injectable()
export class OptionsService {
  private readonly logger = new Logger('OptionsService');

  constructor(
    @InjectRepository(Options)
    private readonly optionRepository: Repository<Options>,
    @InjectRepository(Question)
    private readonly questionRepository: Repository<Question>,
    private readonly dataSource: DataSource,
  ) {}

  async create(createOptionDto: CreateOptionDto, user: User) {
  try {
    const { question, ...optionsDetails } = createOptionDto;
    const questionId = typeof question === 'string' ? question : question?.id;
    const ballotQuestion = await this.questionRepository.findOne({
      where: { id: questionId },
      relations: { election: true },
    });
    if (!ballotQuestion) throw new NotFoundException(`Question with id: ${question} not found`);
    this.ensureBallotCanBeChanged(ballotQuestion.election?.status);

    // 1. Buscar el valor máximo de order para esa pregunta
    const maxOrderResult = await this.optionRepository
      .createQueryBuilder('option')
      .select('MAX(option.order)', 'max')
      .where('option.question = :question', { question })
      .getRawOne();

    const newOrder = (maxOrderResult?.max ?? 0) + 1;

    // 2. Crear y guardar la opción con el nuevo order
    const option = this.optionRepository.create({
      ...optionsDetails,
      order: newOrder,
      question: question,
      userId: user.id,
    });

    await this.optionRepository.save(option);

    return option;
  } catch (error) {
    this.handleDBExceptions(error);
  }
}

  findAll() {
    return `This action returns all options`;
  }

  async findOne(term: string) {
    term = term.toLowerCase();
    let option: Options;

    // if (isUUID(term)) {
    option = await this.optionRepository.findOneBy({ id: term });
    // } else {
    //   const queryBuilder = this.optionRepository.createQueryBuilder('opt');

    //   option = await queryBuilder
    //     .where('LOWER(title)=:title or slug=:slug', {
    //       title: term,
    //       slug: term,
    //     })
    //     .leftJoinAndSelect('opt.images','prodImages')
    //     .getOne();
    // }

    if (!option) throw new NotFoundException(`Option with ${term} not fount`);

    return option;
  }

  // async findOnePlain( term: string) {
  //   const { images = [], ...rest } = await this.findOne(term);

  //   return {
  //     ...rest,
  //     images: images.map( img => img.url)
  //   }
  // }

  async update(id: string, updateOptionDto: UpdateOptionDto) {
    const { ...toUpdate } = updateOptionDto;

    // const optionsList: any = options.map(
    //       (option: any) => this.optionRepository.create(option)
    // );

    const currentOption = await this.optionRepository.findOne({
      where: { id },
      relations: { election: true },
    });
    if (!currentOption) throw new NotFoundException(`Option with id: ${id} not fount`);
    this.ensureBallotCanBeChanged(currentOption.election?.status);

    const option = await this.optionRepository.preload({
      id: id,
      ...toUpdate,
    });

    if (!option) {
      throw new NotFoundException(`Option with id: ${id} not fount`);
    }

    //Create queryRunner
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.manager.save(option);
      await queryRunner.commitTransaction();
      await queryRunner.release();

      return option;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      await queryRunner.release();
      this.handleDBExceptions(error);
    }
  }

  async remove(id: string) {
    const option = await this.optionRepository.findOne({
      where: { id },
      relations: { election: true },
    });
    if (!option) throw new NotFoundException(`Option with ${id} not found`);
    this.ensureBallotCanBeChanged(option.election?.status);

    await this.optionRepository.softRemove(option);
  }

  private ensureBallotCanBeChanged(status?: StatusType): void {
    if (status === StatusType.RUNNING || status === StatusType.COMPLETED) {
      throw new BadRequestException('La boleta no se puede modificar una vez iniciada la eleccion.');
    }
  }

  private handleDBExceptions(error: any) {
    this.logger.error(error);
    if (error.code == '20505') {
      throw new BadRequestException('Ya existe un registro con esos datos.');
    }
    throw new InternalServerErrorException('Ocurrió un error inesperado.');
  }

  async deleteAllOptions(electionId: string) {
    const query = this.optionRepository.createQueryBuilder('option');
    try {
      return await query
        .softDelete()
        .where({eletion: electionId})
        .execute();
    } catch (error) {
      this.handleDBExceptions(error);
    }
  }
}
