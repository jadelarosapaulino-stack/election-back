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

@Injectable()
export class OptionsService {
  private readonly logger = new Logger('OptionsService');

  constructor(
    @InjectRepository(Options)
    private readonly optionRepository: Repository<Options>,
    private readonly dataSource: DataSource,
  ) {}

  async create(createOptionDto: CreateOptionDto, user: User) {
  try {
    const { question, ...optionsDetails } = createOptionDto;

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
    const option = await this.findOne(id);

    await this.optionRepository.remove(option);
  }

  private handleDBExceptions(error: any) {
    if (error.code == '20505') throw new BadRequestException(error.detail);
    this.logger.error(error);
    throw new InternalServerErrorException(error.detail);
  }

  async deleteAllOptions(electionId: string) {
    const query = this.optionRepository.createQueryBuilder('option');
    try {
      return await query
        .delete()
        .where({eletion: electionId})
        .execute();
    } catch (error) {
      this.handleDBExceptions(error);
    }
  }
}
