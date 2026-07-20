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
import { CreateVoterDto, validateVoterMetadata } from './dto/create-voter.dto';
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
import { TimelineAction } from 'src/timeline/timeline.enum';
import {
  ElectionConfig,
  ElectionRunMode,
} from 'src/elections/election-config/entities/election-config.entity';
import { EmailService } from 'src/common/email/email.service';
import { StatusType } from 'src/utils/status-type.enum';

@Injectable()
export class VotersService {
  private readonly logger = new Logger('StatusService');
  constructor(
    @InjectRepository(Voter)
    private readonly _voterRepository: Repository<Voter>,
    @InjectRepository(ElectionConfig)
    private readonly _electionConfigRepository: Repository<ElectionConfig>,
    private readonly _utilsService: UtilsService,
    @Inject(forwardRef(() => ElectionsService))
    private readonly _electionService: ElectionsService,
    private timeline: TimelineService, // MongoDB
    private readonly emailService: EmailService,
  ) {}

  /**
   * Creates a new voter.
   */
  async create(
    electionId: string,
    createVoterDto: CreateVoterDto,
    user: User,
  ): Promise<Voter> {
    const { identifier, password, metadata, name, ...rest } = createVoterDto;

    validateVoterMetadata(metadata as Record<string, unknown> | undefined);
    const election = (await this._electionService.findOne(electionId, user))
      .election;

    const finalIdentifier = identifier || this._generateCode();
    const rawPassword = password || this._generateCode();
    const hashedPassword = await bcrypt.hash(rawPassword, 10);
    const formattedName = this._utilsService.toTitleCase(name);

    await this._validateDuplicateVoter(election.id, finalIdentifier);

    const voter = this._voterRepository.create({
      ...rest,
      name: formattedName,
      identifier: finalIdentifier,
      password: hashedPassword,
      election: { id: election.id } as any,
      metadata: metadata || null,
    });

    const savedVoter = await this._voterRepository.save(voter);
    try {
      await this._logTimeline(savedVoter, metadata);
    } catch (err) {
      this.logger.warn(
        `Could not log timeline for voter ${savedVoter.id}: ${
          err?.message || err
        }`,
      );
    }

    return savedVoter;
  }

  /**
   * Fetch all voters with filters and pagination
   */
  async findAll(
    electionId: string,
    {
      limit = 10,
      offset = 1,
      search = '',
      ordertype = 'ASC',
      voteStatus = 'all',
    }: PaginationDto,
  ): Promise<ResultDto<Voter>> {
    const safeLimit = Math.max(1, limit);
    const currentPage = Math.max(1, offset);
    const skip = (currentPage - 1) * safeLimit;
    const order = ordertype.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    const config = await this._electionConfigRepository.findOne({
      where: { electionId },
      select: ['runMode'],
    });
    const countDemoVotes = config?.runMode === ElectionRunMode.DEMO;

    const query = this._voterRepository
      .createQueryBuilder('voter')
      .leftJoin('voter.election', 'election')
      .where('election.id = :electionId', { electionId })
      .loadRelationCountAndMap(
        'voter.votesCount',
        'voter.votes',
        'voteCount',
        (qb) =>
          qb.andWhere('voteCount.isDemo = :countDemoVotes', { countDemoVotes }),
      );

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

    const normalizedVoteStatus = String(voteStatus || 'all').toLowerCase();
    if (
      normalizedVoteStatus === 'voted' ||
      normalizedVoteStatus === 'pending'
    ) {
      const realVoteExists = query
        .subQuery()
        .select('1')
        .from('votes', 'status_vote')
        .where('status_vote."voterId" = voter.id')
        .andWhere('status_vote."isDemo" = :countDemoVotes')
        .getQuery();

      if (normalizedVoteStatus === 'voted') {
        query.andWhere(`(voter.vote = true OR EXISTS ${realVoteExists})`);
      } else {
        query.andWhere(
          `(COALESCE(voter.vote, false) = false AND NOT EXISTS ${realVoteExists})`,
        );
      }
    }

    const statsQuery = this._voterRepository
      .createQueryBuilder('voter')
      .leftJoin('voter.election', 'election')
      .leftJoin('voter.votes', 'vote', 'vote.isDemo = :countDemoVotes', {
        countDemoVotes,
      })
      .where('election.id = :electionId', { electionId });

    const statsRaw = await statsQuery
      .select('COUNT(DISTINCT voter.id)', 'total')
      .addSelect(
        'COUNT(DISTINCT CASE WHEN voter.vote = true OR vote.id IS NOT NULL THEN voter.id END)',
        'voted',
      )
      .getRawOne();

    const stats = {
      total: Number(statsRaw?.total ?? 0),
      voted: Number(statsRaw?.voted ?? 0),
      pending: Math.max(
        0,
        Number(statsRaw?.total ?? 0) - Number(statsRaw?.voted ?? 0),
      ),
    };

    query.setParameter('countDemoVotes', countDemoVotes);

    const [data, totalPosts] = await query
      .orderBy('voter.createdAt', order)
      .skip(skip)
      .take(safeLimit)
      .getManyAndCount();
    const rows = data.map((voter: any) => {
      const votesCount = Number(voter?.votesCount ?? 0);
      const hasVoted = Boolean(voter?.vote || votesCount > 0);
      const { votes: _votes, ...safeVoter } = voter;
      return {
        ...safeVoter,
        votesCount,
        hasVoted,
      };
    });

    const totalPages = Math.ceil(totalPosts / safeLimit);

    return new ResultDto<Voter>({
      success: true,
      message: 'Votantes obtenidos correctamente',
      data: rows,
      totalPosts,
      totalPages,
      limit: safeLimit,
      currentPage,
      stats,
    });
  }

  /**
   * Get one voter by ID
   */
  async findOne(id: string): Promise<any> {
    const voter = isUUID(id)
      ? await this._voterRepository.findOne({
          where: { id },
          relations: ['election'],
        })
      : await this._voterRepository
          .createQueryBuilder('v')
          .leftJoinAndSelect('v.election', 'election')
          .where('v.id = :id', { id })
          .getOne();

    if (!voter) throw new NotFoundException(`Voter with id ${id} not found`);

    const timelineRecords = await this.timeline.getTimelineBy(voter.id);
    const events = timelineRecords.map((record: any) =>
      typeof record?.toObject === 'function' ? record.toObject() : record,
    );

    const hasAction = (action: string) =>
      events.some((ev: any) => ev?.action === action);

    if (voter?.createdAt && !hasAction('voter_registered')) {
      events.push({
        action: 'voter_registered',
        createdAt: voter.createdAt,
        metadata: { derived: true },
      });
    }

    if (Array.isArray(voter?.votes) && voter.votes.length > 0) {
      const hasVoteCast = hasAction('vote_cast') || hasAction('voted');
      if (!hasVoteCast) {
        const realVotes = voter.votes.filter((vote: any) => !vote?.isDemo);
        const sourceVotes = realVotes.length ? realVotes : voter.votes;
        const votedAt = sourceVotes.reduce((latest: any, vote: any) => {
          const voteTime = vote?.votedAt ? new Date(vote.votedAt).getTime() : 0;
          const latestTime = latest?.votedAt
            ? new Date(latest.votedAt).getTime()
            : 0;
          return voteTime > latestTime ? vote : latest;
        }, sourceVotes[0]);
        events.push({
          action: 'vote_cast',
          createdAt: votedAt?.votedAt || voter.updatedAt || voter.createdAt,
          metadata: {
            derived: true,
            votesCount: sourceVotes.length,
          },
        });
      }
    }

    const endDate = voter?.election?.endDate
      ? new Date(voter.election.endDate)
      : null;
    const status = voter?.election?.status || null;
    const now = new Date();
    const electionEnded = (endDate && endDate <= now) || status === 'completed';

    if (electionEnded && !hasAction('election_ended')) {
      events.push({
        action: 'election_ended',
        createdAt: endDate || voter?.election?.updatedAt || now,
        metadata: { derived: true },
      });
    }

    if (
      voter?.election?.startDate &&
      voter.election.startDate <= now &&
      !hasAction('election_started')
    ) {
      events.push({
        action: 'election_started',
        createdAt: voter.election.startDate,
        metadata: { derived: true },
      });
    }

    events.sort((a: any, b: any) => {
      const aTime = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
      return aTime - bTime;
    });

    const { votes: _votes, ...safeVoter } = voter as any;
    return { ...safeVoter, timeline: { events } };
  }

  async update(id: string, updateVoterDto: UpdateVoterDto): Promise<Voter> {
    const voter = await this._voterRepository.findOne({
      where: { id },
      relations: ['election'],
    });

    if (!voter) {
      throw new NotFoundException(`Votante con ID ${id} no encontrado`);
    }

    validateVoterMetadata(
      updateVoterDto.metadata as Record<string, unknown> | undefined,
    );

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

    // Si cambia la contrasena, hashearla
    if (updateVoterDto.password) {
      updateVoterDto.password = await bcrypt.hash(updateVoterDto.password, 10);
    }

    const payload: any = { ...updateVoterDto };
    if (payload.election) {
      payload.election = { id: payload.election } as any;
    }

    const changedFields = Object.keys(payload).filter((key) => {
      if (key === 'election') return false;
      return payload[key] !== (voter as any)[key];
    });

    const updated = this._voterRepository.merge(voter, payload);
    const saved = await this._voterRepository.save(updated);

    if (changedFields.length > 0) {
      const deviceType =
        payload?.metadata?.deviceType ||
        payload?.metadata?.device?.type ||
        payload?.metadata?.meta?.deviceType ||
        null;
      const deviceModel =
        payload?.metadata?.deviceModel ||
        payload?.metadata?.device?.model ||
        payload?.metadata?.meta?.deviceModel ||
        null;
      const devicePlatform =
        payload?.metadata?.devicePlatform ||
        payload?.metadata?.device?.platform ||
        payload?.metadata?.meta?.devicePlatform ||
        null;
      const deviceBrands =
        payload?.metadata?.deviceBrands ||
        payload?.metadata?.device?.brands ||
        payload?.metadata?.meta?.deviceBrands ||
        null;
      const coords =
        payload?.metadata?.coords || payload?.metadata?.meta?.coords || null;
      try {
        await this.timeline.logAction({
          entityId: saved.id,
          electionId: saved.election?.id || voter.election?.id,
          action: TimelineAction.VOTER_UPDATED,
          metadata: {
            changedFields,
            deviceType,
            deviceModel,
            devicePlatform,
            deviceBrands,
            coords,
          },
        });
      } catch (err) {
        this.logger.warn(
          `Could not log timeline update for voter ${saved.id}: ${
            err?.message || err
          }`,
        );
      }
    }

    return saved;
  }

  /**
   * Remove voter by ID
   */
  async remove(id: string): Promise<{ message: string }> {
    if (!isUUID(id)) {
      throw new BadRequestException('ID invalido');
    }

    if (!id) {
      throw new BadRequestException('El ID del votante es obligatorio');
    }

    const voter = await this._voterRepository.findOne({
      where: { id },
      relations: { election: true, votes: true },
    });
    if (!voter) throw new NotFoundException(`Voter with id ${id} not found`);

    const electionStarted =
      voter.election?.status === StatusType.RUNNING ||
      voter.election?.status === StatusType.COMPLETED;
    const hasVoted = voter.vote || (voter.votes || []).length > 0;
    if (electionStarted && hasVoted) {
      throw new BadRequestException(
        'No se puede eliminar a un votante que ya emitio su voto.',
      );
    }

    await this._voterRepository.softDelete(id);
    return {
      message: `Voter with ID ${id} removed successfully`,
    };
  }

  /**
   * Remove all voters by election ID
   */
  async deleteAllByElection(
    electionId: string,
    user: User,
  ): Promise<{ message: string; deletedCount: number }> {
    const election = await this._electionService.findOne(electionId, user);
    if (!election) {
      throw new NotFoundException('Eleccion no encontrada.');
    }
    if (!electionId) {
      throw new BadRequestException('El ID de la eleccion es obligatorio.');
    }

    const result = await this._voterRepository
      .createQueryBuilder()
      .softDelete()
      .from('voters')
      .where('electionId = :electionId', { electionId })
      .execute();

    return {
      message: `Votantes eliminados exitosamente.`,
      deletedCount: result.affected || 0,
    };
  }

  async sendInvitations(
    electionId: string,
    user: User,
    scope: 'all' | 'pending' = 'pending',
  ): Promise<any> {
    const detail = await this._electionService.findOne(electionId, user);
    const election = detail?.election;
    if (!election?.id) {
      throw new NotFoundException('Eleccion no encontrada.');
    }

    const portalBase = String(process.env.VOTER_PORTAL_URL || '').replace(
      /\/$/,
      '',
    );
    if (!portalBase) {
      throw new BadRequestException('VOTER_PORTAL_URL no esta configurado.');
    }

    const voters = await this._voterRepository.find({
      where: { election: { id: electionId } },
      relations: ['election'],
      order: { createdAt: 'DESC' },
    });
    const targetVoters = voters.filter((voter) => {
      if (scope !== 'pending') return true;
      return !voter.metadata?.invitation?.sentAt;
    });

    let sent = 0;
    let failed = 0;
    let skipped = 0;
    const errors: string[] = [];
    const portalUrl = `${portalBase}/vote/${election.id}`;
    const invitationTemplate = await this.getCommunicationTemplate(
      election.id,
      'invitation',
    );

    for (const voter of targetVoters) {
      if (!voter.email) {
        skipped++;
        errors.push(`${voter.identifier || voter.id}: sin correo`);
        continue;
      }

      try {
        if (invitationTemplate) {
          await this.emailService.sendConfiguredVoterInvitation(
            voter.email,
            this.renderTemplate(
              invitationTemplate.subject,
              election,
              voter,
              portalUrl,
            ),
            this.renderTemplate(
              invitationTemplate.body,
              election,
              voter,
              portalUrl,
            ).replace(/\n/g, '<br>'),
          );
        } else {
          await this.emailService.sendVoterInvitation(
            voter.email,
            election.title,
            portalUrl,
          );
        }
        voter.metadata = {
          ...(voter.metadata || {}),
          invitation: {
            status: 'sent',
            sentAt: new Date().toISOString(),
            lastError: null,
          },
        };
        await this._voterRepository.save(voter);
        sent++;
        await this.timeline.logAction({
          entityId: voter.id,
          electionId: election.id,
          action: TimelineAction.VOTER_INVITATION_SENT,
          metadata: {
            email: voter.email,
            userId: user.id,
            userName: user.fullName || user.email,
          },
        });
      } catch (error) {
        failed++;
        const message = error?.message || 'No se pudo enviar invitacion';
        voter.metadata = {
          ...(voter.metadata || {}),
          invitation: {
            status: 'failed',
            sentAt: voter.metadata?.invitation?.sentAt || null,
            lastError: message,
          },
        };
        await this._voterRepository.save(voter);
        errors.push(`${voter.identifier || voter.id}: ${message}`);
        await this.timeline.logAction({
          entityId: voter.id,
          electionId: election.id,
          action: TimelineAction.VOTER_INVITATION_FAILED,
          metadata: {
            email: voter.email,
            userId: user.id,
            userName: user.fullName || user.email,
            error: message,
          },
        });
      }
    }

    return {
      scope,
      total: targetVoters.length,
      sent,
      failed,
      skipped,
      errors,
    };
  }

  async sendReminders(electionId: string, user: User): Promise<any> {
    const detail = await this._electionService.findOne(electionId, user);
    const election = detail?.election;
    if (!election?.id) {
      throw new NotFoundException('Eleccion no encontrada.');
    }

    const portalBase = String(process.env.VOTER_PORTAL_URL || '').replace(
      /\/$/,
      '',
    );
    if (!portalBase) {
      throw new BadRequestException('VOTER_PORTAL_URL no esta configurado.');
    }

    const reminderTemplate = await this.getCommunicationTemplate(
      election.id,
      'reminder',
    );
    if (!reminderTemplate) {
      throw new BadRequestException(
        'Configura y guarda la plantilla de recordatorio antes de enviar.',
      );
    }

    const voters = await this._voterRepository.find({
      where: { election: { id: electionId } },
      relations: ['election'],
      order: { createdAt: 'DESC' },
    });
    const targetVoters = voters.filter((voter) => !voter.vote);
    const portalUrl = `${portalBase}/vote/${election.id}`;
    let sent = 0;
    let failed = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const voter of targetVoters) {
      if (!voter.email) {
        skipped++;
        errors.push(`${voter.identifier || voter.id}: sin correo`);
        continue;
      }

      try {
        await this.emailService.sendVoterReminder(
          voter.email,
          this.renderTemplate(
            reminderTemplate.subject,
            election,
            voter,
            portalUrl,
          ),
          this.renderTemplate(
            reminderTemplate.body,
            election,
            voter,
            portalUrl,
          ).replace(/\n/g, '<br>'),
        );
        voter.metadata = {
          ...(voter.metadata || {}),
          reminder: {
            status: 'sent',
            sentAt: new Date().toISOString(),
            lastError: null,
          },
        };
        await this._voterRepository.save(voter);
        sent++;
        await this.timeline.logAction({
          entityId: voter.id,
          electionId: election.id,
          action: TimelineAction.VOTER_REMINDER_SENT,
          metadata: {
            email: voter.email,
            userId: user.id,
            userName: user.fullName || user.email,
          },
        });
      } catch (error) {
        failed++;
        const message = error?.message || 'No se pudo enviar recordatorio';
        voter.metadata = {
          ...(voter.metadata || {}),
          reminder: {
            status: 'failed',
            sentAt: voter.metadata?.reminder?.sentAt || null,
            lastError: message,
          },
        };
        await this._voterRepository.save(voter);
        errors.push(`${voter.identifier || voter.id}: ${message}`);
        await this.timeline.logAction({
          entityId: voter.id,
          electionId: election.id,
          action: TimelineAction.VOTER_REMINDER_FAILED,
          metadata: {
            email: voter.email,
            userId: user.id,
            userName: user.fullName || user.email,
            error: message,
          },
        });
      }
    }

    return {
      total: targetVoters.length,
      sent,
      failed,
      skipped,
      errors,
    };
  }

  private async getCommunicationTemplate(
    electionId: string,
    key: 'invitation' | 'reminder' | 'receipt',
  ): Promise<{ subject: string; body: string } | null> {
    const config = await this._electionConfigRepository.findOne({
      where: { electionId },
    });
    const templates = this.asRecord(config?.extra?.communicationTemplates);
    const template = this.asRecord(templates[key]);
    const subject = String(template.subject || '').trim();
    const body = String(template.body || '').trim();
    return subject && body ? { subject, body } : null;
  }

  private renderTemplate(
    template: string,
    election: any,
    voter: Voter,
    portalUrl: string,
  ): string {
    const values: Record<string, string> = {
      electionTitle: String(election?.title || ''),
      voterName: String(voter.name || voter.identifier || ''),
      voterIdentifier: String(voter.identifier || ''),
      voterEmail: String(voter.email || ''),
      portalUrl,
    };

    return template.replace(
      /\{\{\s*(electionTitle|voterName|voterIdentifier|voterEmail|portalUrl)\s*\}\}/g,
      (_, key) => {
        return values[key] || '';
      },
    );
  }

  private asRecord(value: unknown): Record<string, any> {
    return value && typeof value === 'object'
      ? (value as Record<string, any>)
      : {};
  }

  /**
   * Import voters from CSV
   */
  async previewImportFromCsv(
    buffer: Buffer,
    electionId: string,
    user: User,
  ): Promise<any> {
    await this._electionService.findOne(electionId, user);
    const parsed = await this.parseVoterCsvForPreview(buffer, electionId);

    return {
      mode: 'preview',
      requiresConfirmation: true,
      records: parsed.records,
      valid: parsed.valid,
      invalid: parsed.invalid,
      duplicates: parsed.duplicates,
      errors: parsed.errors,
      requiredColumns: ['name', 'email', 'identifier', 'password'],
      canImport: parsed.valid > 0 && parsed.invalid === 0,
    };
  }

  async importFromCsv(
    buffer: Buffer,
    electionId: string,
    metadata: any,
    user: User,
  ): Promise<any> {
    const preview = await this.parseVoterCsvForPreview(buffer, electionId);
    if (preview.invalid > 0) {
      throw new BadRequestException({
        message:
          'El padron contiene errores. Corrige el archivo antes de importar.',
        errors: preview.errors,
        preview,
      });
    }

    const rawLines = buffer.toString('utf8').split(/\r?\n/);
    const election = await this._electionService.findOne(electionId, user);
    const meta = metadata ? JSON.parse(metadata) : undefined;

    // La primera fila no vacia se considera cabecera, aunque existan lineas vacias al inicio.
    const indexedLines = rawLines.map((line, idx) => ({
      raw: (line || '').replace(/^\uFEFF/, ''),
      lineNumber: idx + 1,
    }));
    const headerIndex = indexedLines.findIndex(
      (line) => line.raw.trim().length > 0,
    );
    if (headerIndex < 0) {
      throw new BadRequestException('El CSV no contiene filas de datos.');
    }
    const dataLines = indexedLines
      .slice(headerIndex + 1)
      .filter((line) => line.raw.trim().length > 0);

    if (!dataLines.length) {
      throw new BadRequestException('El CSV no contiene filas de datos.');
    }

    let imported = 0,
      duplicates = 0,
      invalid = 0,
      processed = 0;
    const errors: string[] = [];
    const generatedCredentials: Array<{
      identifier: string;
      password: string;
      line: number;
    }> = [];

    const normalizeCsvValue = (value: string | undefined | null): string => {
      if (value === null || value === undefined) return '';
      let trimmed = String(value).trim();
      if (trimmed.length >= 2) {
        const first = trimmed[0];
        const last = trimmed[trimmed.length - 1];
        if (
          (first === '"' && last === '"') ||
          (first === "'" && last === "'")
        ) {
          trimmed = trimmed.slice(1, -1).trim();
        }
      }
      return trimmed;
    };

    for (const row of dataLines) {
      const lineNumber = row.lineNumber;
      const line = row.raw.trim();

      // Si la fila no tiene datos relevantes, se marca como invalida pero se contabiliza
      if (!line) {
        processed++;
        invalid++;
        errors.push(`Linea ${lineNumber}: Fila vacia`);
        continue;
      }

      const [nameRaw, emailRaw, identifierRaw, passwordRaw] = line.split(',');
      const name = normalizeCsvValue(nameRaw);
      const email = normalizeCsvValue(emailRaw);
      const identifier =
        normalizeCsvValue(identifierRaw) || this._generateCode();
      const passwordValue = normalizeCsvValue(passwordRaw);
      const rawPassword = passwordValue || this._generateCode();

      processed++;

      const dto: CreateVoterDto = {
        name: name || 'Votante',
        email: email || undefined,
        identifier: String(identifier),
        password: String(rawPassword),
        metadata: meta,
        election: String(election.election.id),
      };

      try {
        await this.create(electionId, dto, user);
        imported++;
        if (!passwordValue) {
          generatedCredentials.push({
            identifier: String(identifier),
            password: String(rawPassword),
            line: lineNumber,
          });
        }
      } catch (error) {
        if (error instanceof ConflictException) {
          duplicates++;
          errors.push(`Linea ${lineNumber}: Duplicado`);
        } else {
          invalid++;
          errors.push(`Linea ${lineNumber}: Error inesperado`);
        }
      }
    }

    const result = {
      message: 'Importacion finalizada',
      imported,
      duplicates,
      invalid,
      records: processed,
      generatedCredentials,
      errors,
    };

    this.logger.debug(`Resultado importacion: ${JSON.stringify(result)}`);

    return result;
  }

  private async parseVoterCsvForPreview(buffer: Buffer, electionId: string) {
    const rawLines = buffer.toString('utf8').split(/\r?\n/);
    const indexedLines = rawLines.map((line, idx) => ({
      raw: (line || '').replace(/^\uFEFF/, ''),
      lineNumber: idx + 1,
    }));
    const headerIndex = indexedLines.findIndex(
      (line) => line.raw.trim().length > 0,
    );
    if (headerIndex < 0) {
      throw new BadRequestException('El CSV no contiene cabecera.');
    }

    const headers = indexedLines[headerIndex].raw
      .split(',')
      .map((header) => this.normalizeCsvValue(header).toLowerCase());
    const requiredColumns = ['name', 'email', 'identifier', 'password'];
    const missingColumns = requiredColumns.filter(
      (column) => !headers.includes(column),
    );
    if (missingColumns.length) {
      throw new BadRequestException(
        `Faltan columnas requeridas: ${missingColumns.join(', ')}`,
      );
    }

    const dataLines = indexedLines
      .slice(headerIndex + 1)
      .filter((line) => line.raw.trim().length > 0);

    const existingVoters = await this._voterRepository.find({
      where: { election: { id: electionId } },
      select: ['identifier', 'email'],
    });
    const existingIdentifiers = new Set(
      existingVoters
        .map((voter) =>
          String(voter.identifier || '')
            .trim()
            .toLowerCase(),
        )
        .filter(Boolean),
    );
    const existingEmails = new Set(
      existingVoters
        .map((voter) =>
          String(voter.email || '')
            .trim()
            .toLowerCase(),
        )
        .filter(Boolean),
    );
    const seenIdentifiers = new Set<string>();
    const seenEmails = new Set<string>();
    const errors: string[] = [];
    let valid = 0;
    let invalid = 0;
    let duplicates = 0;

    dataLines.forEach((row) => {
      const values = row.raw
        .split(',')
        .map((value) => this.normalizeCsvValue(value));
      const record = headers.reduce<Record<string, string>>(
        (acc, header, index) => {
          acc[header] = values[index] || '';
          return acc;
        },
        {},
      );
      const rowErrors: string[] = [];
      const name = record['name'];
      const email = record['email'];
      const identifier = record['identifier'];
      const password = record['password'];
      const normalizedIdentifier = String(identifier || '')
        .trim()
        .toLowerCase();
      const normalizedEmail = String(email || '')
        .trim()
        .toLowerCase();

      if (!name) rowErrors.push('nombre requerido');
      if (!identifier) rowErrors.push('identificador requerido');
      if (!password) rowErrors.push('contrasena requerida');
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        rowErrors.push('email invalido');

      if (
        normalizedIdentifier &&
        (seenIdentifiers.has(normalizedIdentifier) ||
          existingIdentifiers.has(normalizedIdentifier))
      ) {
        rowErrors.push('identificador duplicado');
        duplicates++;
      }
      if (
        normalizedEmail &&
        (seenEmails.has(normalizedEmail) || existingEmails.has(normalizedEmail))
      ) {
        rowErrors.push('email duplicado');
        duplicates++;
      }

      if (normalizedIdentifier) seenIdentifiers.add(normalizedIdentifier);
      if (normalizedEmail) seenEmails.add(normalizedEmail);

      if (rowErrors.length) {
        invalid++;
        errors.push(`Linea ${row.lineNumber}: ${rowErrors.join(', ')}`);
      } else {
        valid++;
      }
    });

    return {
      records: dataLines.length,
      valid,
      invalid,
      duplicates,
      errors,
    };
  }

  private normalizeCsvValue(value: string | undefined | null): string {
    if (value === null || value === undefined) return '';
    let trimmed = String(value).trim();
    if (trimmed.length >= 2) {
      const first = trimmed[0];
      const last = trimmed[trimmed.length - 1];
      if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
        trimmed = trimmed.slice(1, -1).trim();
      }
    }
    return trimmed;
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

    return voters.map((voter: any) => {
      const { votes: _votes, ...safeVoter } = voter;
      return safeVoter;
    }) as Voter[];
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

      // Manten solo el primero
      const [keep, ...toDelete] = duplicatesToDelete;
      if (toDelete.length > 0) {
        const ids = toDelete.map((v) => v.id);
        await this._voterRepository.softDelete(ids);
        totalDeleted += ids.length;
      }
    }

    return { deleted: totalDeleted };
  }

  async previewDuplicatesByElection(electionId: string): Promise<{
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
