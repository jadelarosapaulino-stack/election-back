import {
  BadRequestException,
  ConflictException,
  forwardRef,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateVoterDto } from './dto/create-voter.dto';
import { UpdateVoterDto } from './dto/update-voter.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Voter } from './entities/voter.entity';
import { Repository } from 'typeorm';
import { UtilsService } from 'src/utils/utils.service';
import { isUUID } from 'class-validator';
import { TimelineService } from 'src/timeline/timeline.service';
import { ElectionsService } from 'src/elections/elections.service';
import * as bcrypt from 'bcrypt';
import { ResultDto } from 'src/utils/result.dto';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { User } from 'src/auth/entities/user.entity';

@Injectable()
export class VotersService {
  private readonly logger = new Logger('StatusService');
  constructor(
    @InjectRepository(Voter)
    private readonly _voterRepository: Repository<Voter>,
    private readonly _utilsService: UtilsService,
    @Inject(forwardRef(() => ElectionsService))
    private readonly _electionService: ElectionsService,
    private timeline: TimelineService, // MongoDB
  ) {}

  /**
   * Creates a new voter.
   */
  async create(createVoterDto: CreateVoterDto): Promise<Voter> {
    const { election, identifier, password, metadata, name, ...rest } =
      createVoterDto;

    const finalIdentifier = identifier || this._generateCode();
    const rawPassword = password || this._generateCode();
    const hashedPassword = await bcrypt.hash(rawPassword, 10);
    const formattedName = this._utilsService.toTitleCase(name);

    await this._validateDuplicateVoter(election, finalIdentifier);

    const voter = this._voterRepository.create({
      ...rest,
      name: formattedName,
      identifier: finalIdentifier,
      password: hashedPassword,
      election,
    });

    const savedVoter = await this._voterRepository.save(voter);
    await this._logTimeline(savedVoter, metadata);

    return savedVoter;
  }

  /**
   * Fetch all voters with filters and pagination
   */
  async findAll(
    electionId: string,
    { limit = 10, offset = 1, search = '', ordertype = 'ASC' }: PaginationDto,
  ): Promise<ResultDto<Voter>> {
    const safeLimit = Math.max(1, limit);
    const currentPage = Math.max(1, offset);
    const skip = (currentPage - 1) * safeLimit;
    const order = ordertype.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    const query = this._voterRepository
      .createQueryBuilder('voter')
      .leftJoin('voter.election', 'election')
      .where('election.id = :electionId', { electionId });

    if (search.trim()) {
      query.andWhere(
        `
      LOWER(voter.name) LIKE LOWER(:search)
      OR LOWER(voter.identifier) LIKE LOWER(:search)
      OR LOWER(voter.email) LIKE LOWER(:search)
    `,
        { search: `%${search}%` },
      );
    }

    const [data, totalPosts] = await query
      .orderBy('voter.createdAt', order)
      .skip(skip)
      .take(safeLimit)
      .getManyAndCount();

    const totalPages = Math.ceil(totalPosts / safeLimit);

    return new ResultDto<Voter>({
      success: true,
      message: 'Votantes obtenidos correctamente',
      data,
      totalPosts,
      totalPages,
      limit: safeLimit,
      currentPage,
    });
  }

  /**
   * Get one voter by ID
   */
  async findOne(id: string): Promise<any> {
    const voter = isUUID(id)
      ? await this._voterRepository.findOneBy({ id })
      : await this._voterRepository
          .createQueryBuilder('v')
          .where('v.id = :id', { id })
          .getOne();

    if (!voter) throw new NotFoundException(`Voter with id ${id} not found`);

    const timeline = await this.timeline.getTimelineBy(voter.id);
    return { ...voter, timeline };
  }

  async update(id: string, updateVoterDto: UpdateVoterDto): Promise<Voter> {
    const voter = await this._voterRepository.findOne({
      where: { id },
      relations: ['election'],
    });

    if (!voter) {
      throw new NotFoundException(`Votante con ID ${id} no encontrado`);
    }

    // Si cambia el nombre, normalizarlo
    if (updateVoterDto.name) {
      updateVoterDto.name = this._utilsService.toTitleCase(updateVoterDto.name);
    }

    // Si cambia el identificador, verificar duplicado
    if (
      updateVoterDto.identifier &&
      updateVoterDto.identifier !== voter.identifier
    ) {
      await this._validateDuplicateVoter(
        voter.election.id,
        updateVoterDto.identifier,
      );
    }

    // Si cambia la contraseña, hashearla
    if (updateVoterDto.password) {
      updateVoterDto.password = await bcrypt.hash(updateVoterDto.password, 10);
    }

    const updated = this._voterRepository.merge(voter, updateVoterDto);
    return await this._voterRepository.save(updated);
  }

  /**
   * Remove voter by ID
   */
  async remove(id: string): Promise<{ message: string }> {
    if (!isUUID(id)) {
      throw new BadRequestException('ID inválido');
    }

    if (!id) {
      throw new BadRequestException('El ID del votante es obligatorio');
    }

    const voter = await this._voterRepository.findOneBy({ id });
    if (!voter) throw new NotFoundException(`Voter with id ${id} not found`);

    await this._voterRepository.delete(id);
    return {
      message: `Voter with ID ${id} removed successfully`,
    };
  }

  /**
   * Remove all voters by election ID
   */
  async deleteAllByElection(
    electionId: string,
    user: User
  ): Promise<{ message: string; deletedCount: number }> {
    const election = await this._electionService.findOne(electionId, user);
    if (!election) {
      throw new NotFoundException('Elección no encontrada.');
    }
    if (!electionId) {
      throw new BadRequestException('El ID de la elección es obligatorio.');
    }

    const result = await this._voterRepository
      .createQueryBuilder()
      .delete()
      .from('voters') // O usa directamente la entidad: .from(Voter)
      .where('electionId = :electionId', { electionId })
      .andWhere('user = :userId', { userId: user.id })
      .execute();

    return {
      message: `Votantes eliminados exitosamente.`,
      deletedCount: result.affected || 0,
    };
  }

  /**
   * Import voters from CSV
   */
  async importFromCsv(
    buffer: Buffer,
    electionId: string,
    metadata: any,
    user: User
  ): Promise<any> {
    const lines = buffer
      .toString()
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const election = await this._electionService.findOne(electionId, user);
    const meta = metadata ? JSON.parse(metadata) : undefined;

    let imported = 0,
      duplicates = 0,
      invalid = 0;
    const errors: string[] = [];

    for (const [index, line] of lines.entries()) {
      if (index === 0 && line.toLowerCase().includes('identifier')) continue;

      const [nameRaw, emailRaw, identifierRaw, passwordRaw] = line.split(',');
      const identifier = identifierRaw?.trim() || this._generateCode();
      const password = passwordRaw?.trim() || this._generateCode();

      if (!identifier) {
        invalid++;
        errors.push(`Línea ${index + 1}: Identificador vacío`);
        continue;
      }

      const dto: CreateVoterDto = {
        name: nameRaw?.trim(),
        email: emailRaw?.trim(),
        identifier,
        password,
        metadata: meta,
        election: election.election.id,
      };

      try {
        await this.create(dto);
        imported++;
      } catch (error) {
        if (error instanceof ConflictException) {
          duplicates++;
          errors.push(`Línea ${index + 1}: Duplicado`);
        } else {
          invalid++;
          errors.push(`Línea ${index + 1}: Error inesperado`);
        }
      }
    }

    const result = {
      message: 'Importación finalizada',
      imported,
      duplicates,
      invalid,
      records: lines.length,
      errors,
    };

    this.logger.error(`result of import, ${result}`);

    return result;
  }

  /**
   * Count voters of an election
   */
  async votersCountOfElection(electionId: string): Promise<number> {
    try {
      return await this._voterRepository.count({
        where: { election: { id: electionId } },
      });
    } catch (error) {
      this.logger.error('Error counting voters:', error);
      throw new InternalServerErrorException('Error counting voters');
    }
  }

  /**
   * Save to timeline (Mongo)
   */
  private async _logTimeline(voter: Voter, metadata: any) {
    const { id, election }: any = voter;

    if (!voter?.id || !voter?.election) {
      throw new BadRequestException('Invalid data to save to timeline');
    }

    await this.timeline.logAction({
      entityId: id,
      electionId: election,
      action: 'voter_registered',
      metadata: metadata || {},
    });
  }

  /**
   * Validates voter uniqueness
   */
  private async _validateDuplicateVoter(
    electionId: any,
    identifier: string,
  ): Promise<void> {
    const exists = await this._voterRepository
      .createQueryBuilder('voter')
      .innerJoin('voter.election', 'election')
      .where('election.id = :electionId', { electionId })
      .andWhere('voter.identifier = :identifier', { identifier })
      .getExists();

    if (exists) {
      throw new ConflictException('Votante ya registrado');
    }
  }

  /**
   * Generates a numeric 10-digit random code
   */
  private _generateCode(): string {
    return this._utilsService.generateRandomUserCode('numeric', 10);
  }

  /**
   * Get all voters of an election
   */

  async getVotersOfElection(electionId: string): Promise<Voter[]> {
    const voters = await this._voterRepository.find({
      where: { election: { id: electionId } },
      relations: ['election'],
      order: { createdAt: 'DESC' },
    });

    if (!voters || voters.length === 0) {
      throw new NotFoundException(
        `No voters found for election with ID ${electionId}`,
      );
    }

    return voters;
  }

  /**
   * Returns all duplicate voters grouped by name and identifier.
   */
  async findDuplicates(electionId: string): Promise<Voter[]> {
    return await this._voterRepository
      .createQueryBuilder('voter')
      .select(['voter.id', 'voter.name', 'voter.identifier', 'voter.createdAt'])
      .innerJoin(
        (qb) =>
          qb
            .select('v.name', 'name')
            .addSelect('v.identifier', 'identifier')
            .from(Voter, 'v')
            .where('v.election = :electionId')
            .groupBy('v.name, v.identifier')
            .having('COUNT(*) > 1'),
        'dup',
        'dup.name = voter.name AND dup.identifier = voter.identifier',
      )
      .where('voter.election = :electionId')
      .setParameter('electionId', electionId)
      .getMany();
  }

  /**
   * Deletes duplicate voters, keeping only the first one per (name, identifier) group.
   */
  async deleteDuplicatesByElection(
    electionId: string,
  ): Promise<{ deleted: number }> {
    const duplicates = await this._voterRepository
      .createQueryBuilder('voter')
      .select(['voter.name', 'voter.identifier'])
      .addSelect('COUNT(*) as count')
      .where('voter.election = :electionId', { electionId })
      .groupBy('voter.name, voter.identifier')
      .having('COUNT(*) > 1')
      .getRawMany();

    let totalDeleted = 0;

    for (const dup of duplicates) {
      const { voter_name: name, voter_identifier: identifier } = dup;

      // Busca todos los registros duplicados
      const duplicatesToDelete = await this._voterRepository.find({
        where: { election: { id: electionId }, name, identifier },
        order: { createdAt: 'ASC' },
      });

      // Mantén solo el primero
      const [keep, ...toDelete] = duplicatesToDelete;
      if (toDelete.length > 0) {
        const ids = toDelete.map((v) => v.id);
        await this._voterRepository.delete(ids);
        totalDeleted += ids.length;
      }
    }

    return { deleted: totalDeleted };
  }

  async previewDuplicatesByElection(electionId: string, user: User): Promise<{
    totalDuplicateGroups: number;
    totalPotentialDeletions: number;
    duplicateGroups: {
      name: string;
      identifier: string;
      total: number;
      toDelete: number;
    }[];
  }> {
    const duplicates = await this._voterRepository
      .createQueryBuilder('voter')
      .select(['voter.name AS name', 'voter.identifier AS identifier'])
      .addSelect('COUNT(*) AS total')
      .where('voter.election = :electionId', { electionId })
      .andWhere('voter.user = :userId', { userId: user.id })
      .groupBy('voter.name, voter.identifier')
      .having('COUNT(*) > 1')
      .getRawMany();

    const result = duplicates.map((dup) => ({
      name: dup.name,
      identifier: dup.identifier,
      total: Number(dup.total),
      toDelete: Number(dup.total) - 1,
    }));

    return {
      totalDuplicateGroups: result.length,
      totalPotentialDeletions: result.reduce((sum, g) => sum + g.toDelete, 0),
      duplicateGroups: result,
    };
  }
}
