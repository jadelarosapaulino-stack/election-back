import { BadRequestException, ConflictException, Injectable, InternalServerErrorException, Logger, NotFoundException } from "@nestjs/common";
import { Question } from "./entities/question.entity";
import { InjectRepository } from "@nestjs/typeorm";
import { Options } from "src/options/entities/option.entity";
import { DataSource, Repository } from "typeorm";
import { CreateQuestionDto } from "./dto/create-question.dto";
import { ResultDto } from "src/utils/result.dto";
import { PaginationDto } from "src/common/dto/pagination.dto";
import { TenantsService } from "src/tenants/users-settings.service";
import { UpdateQuestionDto } from "./dto/update-question.dto";
import { OrderDto } from "src/options/dto/update-option-order.dto";
import { User } from "src/auth/entities/user.entity";

@Injectable()
export class QuestionsService {
  private readonly logger = new Logger('QuestionsService');

  constructor(
    @InjectRepository(Question)
    private readonly questionRepository: Repository<Question>,
    @InjectRepository(Options)
    private readonly optionRepository: Repository<Options>,
    private readonly dataSource: DataSource,
    private readonly tenantService: TenantsService, // agregado
  ) {}

  async create(createQuestionDto: CreateQuestionDto, user: User) {
    try {
      const { options, ...questionDetails } = createQuestionDto;
      const optionsList = options.map(option =>
        this.optionRepository.create(option)
      );

      const question = this.questionRepository.create({
        ...questionDetails,
        options: optionsList,
        userId: user.id, // asignar tenantId
      });

      await this.questionRepository.save(question);
      return question;
    } catch (error) {
      this.handleDBExceptions(error);
    }
  }
  
  async findAll(
    term: string,
    paginationDto: PaginationDto,
    user: User
  ): Promise<ResultDto<Question>> {
    const { limit = 10, offset = 1 } = paginationDto;

    try {
      const [questions, totalPosts] =
        await this.questionRepository.findAndCount({
          where: [{ election: term, userId: user.id }], // filtro tenantId
          take: limit,
          skip: (offset - 1) * limit,
          relations: { options: true },
          order: {
            order: 'ASC',
            options: { order: 'ASC' },
          },
        });

      return new ResultDto<Question>({
        success: true,
        message: 'Preguntas obtenidas correctamente',
        data: questions,
        totalPosts,
        totalPages: Math.ceil(totalPosts / limit),
        currentPage: offset,
        limit,
      });
    } catch (error) {
      this.logger.error(error);
      return new ResultDto<Question>({
        success: false,
        message: 'Error al obtener las preguntas',
        data: [],
        totalPosts: 0,
        totalPages: 0,
        currentPage: offset,
        limit,
      });
    }
  }

  async update(id: string, updateQuestionDto: UpdateQuestionDto, user: User) {
    const { options, ...toUpdate } = updateQuestionDto;
    const optionsList = options.map(option => this.optionRepository.create(option));

    // Preload pregunta verificando tenantId
    const question = await this.questionRepository.preload({
      id,
      ...toUpdate,
      options: optionsList,
      userId: user.id, // asignar tenantId
    });

    if (!question) throw new NotFoundException(`Question with id: ${id} not found`);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      if (options) {
        await queryRunner.manager.delete(Options, { question: { id }, userId: user.id });
        question.options = options.map(option =>
          this.optionRepository.create(option),
        );
      }

      await queryRunner.manager.save(question);
      await queryRunner.commitTransaction();
      await queryRunner.release();

      return question;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      await queryRunner.release();
      this.handleDBExceptions(error);
    }
  }

  async remove(id: string, user: User) {
    const question = await this.questionRepository.findOneBy({ id, userId: user.id });

    if (!question) throw new NotFoundException(`Question with id: ${id} not found`);

    await this.questionRepository.delete({ id, userId: user.id });
    return { message: `Question with id ${id} removed` };
  }

  async deleteAllQuestions(electionId: string, user: User) {
    try {
      return await this.questionRepository
        .createQueryBuilder('question')
        .delete()
        .where('election = :electionId AND userId = :userId', { electionId, userId: user.id })
        .execute();
    } catch (error) {
      this.handleDBExceptions(error);
    }
  }

  async reorderQuestions(dto: OrderDto[], user: User): Promise<boolean> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      for (const { id, order } of dto) {
        // Actualizar solo si pertenece al tenant actual
        await queryRunner.manager.update(Question, { id, userId: user.id }, { order });
      }
      await queryRunner.commitTransaction();
      return true;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.handleDBExceptions(error);
    } finally {
      await queryRunner.release();
    }
  }

  async questionsCountOfElection(electionId: string, user: User) {
    try {
      return await this.questionRepository.count({
        where: { election: electionId, userId: user.id },
      });
    } catch (error) {
      this.logger.error('Not Found');
      return 0;
    }
  }

  async reorderOptions(questionId: string, newOrder: OrderDto[], user: User): Promise<string> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const question = await queryRunner.manager.findOne(this.questionRepository.target, {
        where: { id: questionId, userId: user.id },
        relations: ['options'],
      });

      if (!question) throw new NotFoundException('Question not found');

      const optionsMap = new Map(question.options.map(opt => [opt.id, opt]));
      const options = Array.from(optionsMap.values());

      // Neutralizar orden temporalmente para evitar colisiones
      options.forEach((opt, i) => {
        opt.order = options.length + i + 1;
      });

      await queryRunner.manager.save(this.optionRepository.target, options);

      for (const { id, order } of newOrder) {
        const opt = optionsMap.get(id);
        if (!opt) {
          throw new BadRequestException(`Option with ID ${id} does not exist for this question`);
        }
        opt.order = order;
      }

      await queryRunner.manager.save(this.optionRepository.target, Array.from(optionsMap.values()));

      await queryRunner.commitTransaction();
      return 'Option order updated';
    } catch (error) {
      await queryRunner.rollbackTransaction();

      if (error.code === '23505') {
        throw new ConflictException('Duplicated order detected during reordering');
      }

      this.logger.error('Error in reorderOptions:', error);
      throw new InternalServerErrorException('Error while reordering options');
    } finally {
      await queryRunner.release();
    }
  }

  private handleDBExceptions(error: any) {
    if (error.code === '23505' || error.code === '20505') { // Postgres or other DB unique violation codes
      throw new BadRequestException(error.detail);
    }
    this.logger.error(error);
    throw new InternalServerErrorException(error.detail);
  }
}
