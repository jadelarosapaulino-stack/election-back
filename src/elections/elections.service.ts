import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { CreateElectionDto } from './dto/create-election.dto';
import { UpdateElectionDto } from './dto/update-election.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Election } from './entities/election.entity';
import { DataSource, In, Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { PaginationDto } from '../common/dto/pagination.dto';
import { isUUID } from 'class-validator';
import { VotersService } from '../voters/voters.service';
import { QuestionsService } from '../questions/questions.service';
import { StatusType } from '../utils/status-type.enum';
import { ResultDto } from '../utils/result.dto';
import { ElectionConfigService } from './election-config/election-config.service';
import { ElectionConfig, ElectionRunMode, TieBreaker } from './election-config/entities/election-config.entity';
import { Vote } from '../vote/entities/vote.entity';
import { Options } from '../options/entities/option.entity';
import { TimelineService } from '../timeline/timeline.service';
import { Voter } from '../voters/entities/voter.entity';
import { TimelineAction } from '../timeline/timeline.enum';
import { ElectionMembership, ElectionMembershipRole, ElectionMembershipStatus } from './entities/election-membership.entity';
import { Question } from '../questions/entities/question.entity';
import { PlanPurchase } from '../billing/entities/plan-purchase.entity';

type ApprovalSection = 'voters' | 'ballot' | 'schedule' | 'publication';
type ApprovalStatus = 'pending' | 'approved' | 'rejected';
type CommunicationTemplateKey = 'invitation' | 'reminder' | 'receipt';
type WizardStepKey =
  | 'basic_info'
  | 'schedule'
  | 'authentication'
  | 'voters'
  | 'ballot'
  | 'rules'
  | 'demo'
  | 'approval'
  | 'publication';
type SupervisionRole = 'commission' | 'observer';

@Injectable()
export class ElectionsService {
  private readonly logger = new Logger('ElectionService');

  constructor(
    @InjectRepository(Election)
    private readonly electionRepository: Repository<Election>,
    @InjectRepository(ElectionConfig)
    private readonly configRepository: Repository<ElectionConfig>,
    @InjectRepository(Vote)
    private readonly voteRepository: Repository<Vote>,
    @InjectRepository(Options)
    private readonly optionsRepository: Repository<Options>,
    @InjectRepository(Voter)
    private readonly voterRepository: Repository<Voter>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(ElectionMembership)
    private readonly membershipRepository: Repository<ElectionMembership>,
    private readonly dataSource: DataSource,
    @Inject(forwardRef(() => VotersService))
    private readonly votersService: VotersService,
    @Inject(forwardRef(() => QuestionsService))
    private readonly questionsService: QuestionsService,
    private readonly electionConfigService: ElectionConfigService,
    private readonly timeline: TimelineService,
  ) {}

  private normalizeOrder(ordertype: unknown): 'ASC' | 'DESC' {
    const order = typeof ordertype === 'string' ? ordertype.toUpperCase() : '';
    return order === 'ASC' ? 'ASC' : 'DESC';
  }

  private normalizeStatusFilter(status: unknown): StatusType | undefined | 'invalid' {
    const value = typeof status === 'string' ? status.trim().toLowerCase() : '';
    if (!value) return undefined;
    return (Object.values(StatusType) as string[]).includes(value)
      ? (value as StatusType)
      : 'invalid';
  }

  private normalizeRole(role: unknown): string {
    return String(role || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  private hasElevatedAccess(user: User): boolean {
    const roles = (user.roles || []).map((role) => this.normalizeRole(role));
    return roles.includes('superadmin') || roles.includes('superuser');
  }

  private async ensureElectionAccess(election: Election, user: User): Promise<void> {
    const ownerId = (election as any).user?.id || (election as any).userId;
    if (ownerId === user.id || this.hasElevatedAccess(user)) return;

    const userEmail = String(user.email || '').trim().toLowerCase();
    const membership = await this.membershipRepository.findOne({
      where: [
        { electionId: election.id, userId: user.id, status: ElectionMembershipStatus.ACCEPTED },
        { electionId: election.id, email: userEmail, status: ElectionMembershipStatus.ACCEPTED },
      ],
    });
    const hasMembership = Boolean(membership) || await this.hasLegacySupervisionMembership(election.id, user);
    if (!hasMembership) {
      throw new NotFoundException(`Election with ${election.id} not found`);
    }
  }

  private async ensureElectionManagementAccess(
    election: Election,
    user: User,
    roles: ElectionMembershipRole[] = [ElectionMembershipRole.COMMISSION],
  ): Promise<void> {
    const ownerId = (election as any).user?.id || (election as any).userId;
    if (ownerId === user.id || this.hasElevatedAccess(user)) return;
    const userEmail = String(user.email || '').trim().toLowerCase();
    const membership = await this.membershipRepository.findOne({
      where: [
        { electionId: election.id, userId: user.id, status: ElectionMembershipStatus.ACCEPTED },
        { electionId: election.id, email: userEmail, status: ElectionMembershipStatus.ACCEPTED },
      ],
    });
    if (!membership || !roles.includes(membership.role)) {
      throw new NotFoundException(`Election with ${election.id} not found`);
    }
  }

  private async hasLegacySupervisionMembership(electionId: string, user: User): Promise<boolean> {
    const config = await this.configRepository.findOne({ where: { electionId }, select: ['id', 'extra'] });
    const email = String(user.email || '').trim().toLowerCase();
    return this.normalizedSupervisionMembers(this.asRecord(config?.extra).supervisionMembers)
      .some((member) => (member.userId && member.userId === user.id) || member.email === email);
  }

  private async getConfigByElection(electionId: string): Promise<ElectionConfig> {
    const config = await this.configRepository.findOne({ where: { electionId } });
    if (!config) throw new NotFoundException('Configuracion de eleccion no encontrada.');
    return config;
  }

  private async findAssignedElections(
    user: User,
    search: string,
    statusFilter?: StatusType,
  ): Promise<Election[]> {
    const userEmail = String(user.email || '').trim().toLowerCase();
    const memberships = await this.membershipRepository.find({
      where: [
        { userId: user.id, status: ElectionMembershipStatus.ACCEPTED },
        { email: userEmail, status: ElectionMembershipStatus.ACCEPTED },
      ],
    });
    const configs = await this.configRepository.find({ select: ['electionId', 'extra'] });
    const legacyIds = configs.filter((config) => {
      return this.normalizedSupervisionMembers(this.asRecord(config.extra).supervisionMembers)
        .some((member) => (member.userId && member.userId === user.id) || member.email === userEmail);
    }).map((config) => config.electionId);
    const assignedIds = Array.from(new Set([...memberships.map((membership) => membership.electionId), ...legacyIds]));
    if (!assignedIds.length) return [];

    const elections = await this.electionRepository.find({
      where: { id: In(assignedIds) },
      order: { createdAt: 'DESC' },
    });
    const normalizedSearch = search.trim().toLowerCase();
    return elections.filter((election) => {
      if (statusFilter && election.status !== statusFilter) return false;
      if (!normalizedSearch) return true;
      return (
        String(election.title || '').toLowerCase().includes(normalizedSearch) ||
        String(election.description || '').toLowerCase().includes(normalizedSearch)
      );
    });
  }

  private async findElectionEntity(
    term: string,
    user: User,
  ): Promise<Election> {
    const normalizedTerm = term.toLowerCase();
    let election: Election | null;

    if (isUUID(term)) {
      election = await this.electionRepository.findOne({
        where: { id: term },
        relations: ['user'],
      });
    } else {
      election = await this.electionRepository
        .createQueryBuilder('election')
        .leftJoinAndSelect('election.user', 'user')
        .where(
          '(LOWER(election.title) = :title OR election.id = :id)',
          { title: normalizedTerm, id: term },
        )
        .getOne();
    }

    if (!election) {
      throw new NotFoundException(`Election with ${term} not found`);
    }
    await this.ensureElectionAccess(election, user);

    return election;
  }

  async create(createElectionDto: CreateElectionDto, user: User) {
    try {
      const { status = StatusType.ACTIVE, ...electionDetails } =
        createElectionDto;

      if (createElectionDto.startDate && createElectionDto.endDate) {
        const start = new Date(createElectionDto.startDate);
        const end = new Date(createElectionDto.endDate);

        if (start > end) {
          throw new BadRequestException(
            'startDate must be earlier than endDate',
          );
        }
      }

      const election = this.electionRepository.create({
        ...electionDetails,
        status,
        user: user,
        questions: [],
        options: [],
        voters: [],
      });
      await this.electionRepository.save(election);

      // Crear configuración por defecto asociada a la elección
      await this.electionConfigService.createConfig({
        electionId: election.id,
        election,
        userId: user.id,
        user,
      });

      return election;
    } catch (error) {
      this.handleDBExceptions(error);
    }
  }

  async findAll(paginationDto: PaginationDto, user: User) {
    try {
      const {
        limit = 10,
        offset = 0,
        ordertype = 'DESC',
        search = '',
        status = '',
      } = paginationDto;

      // Normalize potentially invalid query-string values (e.g. NaN, empty, non-numeric).
      const parsedLimit = Number(limit);
      const parsedOffset = Number(offset);
      const take =
        Number.isFinite(parsedLimit) && parsedLimit > 0
          ? Math.floor(parsedLimit)
          : 10;
      const skip =
        Number.isFinite(parsedOffset) && parsedOffset >= 0
          ? Math.floor(parsedOffset)
          : 0;
      const order = this.normalizeOrder(ordertype);
      const statusFilter = this.normalizeStatusFilter(status);
      const currentPage = Math.floor(skip / take) + 1;

      if (statusFilter === 'invalid') {
        return new ResultDto<Election>({
          success: true,
          message: 'Elecciones obtenidas correctamente',
          data: [],
          totalPosts: 0,
          totalPages: 0,
          currentPage,
          limit: take,
        });
      }

      const queryBuilder = this.electionRepository
        .createQueryBuilder('election')
        .where('election.userId = :userId', { userId: user.id });

      if (search.trim()) {
        queryBuilder.andWhere(
          '(LOWER(election.title) LIKE :search OR LOWER(election.description) LIKE :search)',
          { search: `%${search.toLowerCase()}%` },
        );
      }

      if (statusFilter) {
        queryBuilder.andWhere('election.status = :status', {
          status: statusFilter,
        });
      }

      const [data, ownTotalPosts] = await queryBuilder
        .orderBy('election.createdAt', order)
        .skip(skip)
        .take(take)
        .getManyAndCount();
      const assignedElections = await this.findAssignedElections(user, search, statusFilter);
      const knownIds = new Set(data.map((election) => election.id));
      const dataWithAssignments = [
        ...data,
        ...assignedElections.filter((election) => !knownIds.has(election.id)),
      ];
      const totalPosts = ownTotalPosts + assignedElections.filter((election) => !knownIds.has(election.id)).length;

      if (dataWithAssignments.length) {
        const electionIds = dataWithAssignments.map((election) => election.id);
        const userEmail = String(user.email || '').trim().toLowerCase();
        const [configs, voterCountRows, membershipRows] = await Promise.all([
          this.configRepository.find({
            where: { electionId: In(electionIds) },
            select: ['electionId', 'startAt', 'endAt'],
          }),
          this.voterRepository
            .createQueryBuilder('voter')
            .innerJoin('voter.election', 'election')
            .leftJoin('voter.votes', 'realVote', 'realVote.isDemo = false')
            .select('election.id', 'electionId')
            .addSelect('COUNT(DISTINCT voter.id)', 'totalVoters')
            .addSelect(
              'COUNT(DISTINCT CASE WHEN voter.vote = true OR realVote.id IS NOT NULL THEN voter.id END)',
              'votersWhoVoted',
            )
            .where('election.id IN (:...electionIds)', { electionIds })
            .groupBy('election.id')
            .getRawMany(),
          this.membershipRepository.find({
            where: [
              { userId: user.id, status: ElectionMembershipStatus.ACCEPTED },
              { email: userEmail, status: ElectionMembershipStatus.ACCEPTED },
            ],
          }),
        ]);
        const configMap = new Map(
          configs.map((config) => [config.electionId, config]),
        );
        const voterCountMap = new Map(
          voterCountRows.map((row) => [
            row.electionId as string,
            {
              totalVoters: Number(row.totalVoters ?? 0),
              votersWhoVoted: Number(row.votersWhoVoted ?? 0),
            },
          ]),
        );
        const membershipMap = new Map(membershipRows.map((membership) => [membership.electionId, membership]));
        dataWithAssignments.forEach((election) => {
          const config = configMap.get(election.id);
          if (config?.startAt) {
            election.startDate = config.startAt;
          }
          if (config?.endAt) {
            election.endDate = config.endAt;
          }
          const voterStats = voterCountMap.get(election.id) || { totalVoters: 0, votersWhoVoted: 0 };
          (election as any).totalVoters = voterStats.totalVoters;
          (election as any).votersCount = voterStats.totalVoters;
          (election as any).votersWhoVoted = voterStats.votersWhoVoted;
          (election as any).participationPct =
            voterStats.totalVoters > 0
              ? Number(((voterStats.votersWhoVoted / voterStats.totalVoters) * 100).toFixed(1))
              : 0;
          const membership = membershipMap.get(election.id);
          (election as any).accessContext = membership
            ? { type: 'shared', role: membership.role, status: membership.status }
            : { type: 'owned', role: 'owner', status: 'accepted' };
        });
      }

      return new ResultDto<Election>({
        success: true,
        message: 'Elecciones obtenidas correctamente',
        data: dataWithAssignments,
        totalPosts,
        totalPages: Math.ceil(totalPosts / take),
        currentPage,
        limit: take,
      });
    } catch (error) {
      this.handleDBExceptions(error);
    }
  }

  async findOne(term: string, user: User) {
    const election = await this.findElectionEntity(term, user);

    const voters = await this.votersService.findAll(election.id, {
      limit: 10,
      offset: 1,
      ordertype: 'DESC',
      search: '',
    });
    const ownerId = (election as any).user?.id || user.id;
    const questions = (await this.questionReadinessRows(election.id, ownerId)).length;

    return {
      election: election,
      voters: voters,
      questionsCount: questions || 0,
    };
  }

  async getElectionContext(id: string, user: User) {
    const election = await this.findElectionEntity(id, user);
    return {
      id: election.id,
      title: election.title,
      status: election.status,
      startDate: election.startDate,
      endDate: election.endDate,
    };
  }

  async getReadiness(id: string, user: User) {
    const election = await this.findElectionEntity(id, user);
    const readiness = await this.buildReadiness(election, user);

    await this.safeLogElectionAction(election.id, TimelineAction.ELECTION_READINESS_VIEWED, user, {
      ready: readiness.ready,
      completedRequirements: readiness.requirements.filter((item) => item.done).length,
      totalRequirements: readiness.requirements.length,
    });

    return readiness;
  }

  async getAutomationReadiness(id: string) {
    const election = await this.electionRepository.findOne({
      where: { id },
      relations: ['user'],
    });
    if (!election || !election.user) {
      throw new NotFoundException('Eleccion no encontrada para validar el inicio automatico.');
    }
    return this.buildReadiness(election, election.user);
  }

  async getWizard(id: string, user: User) {
    const election = await this.findElectionEntity(id, user);
    const readiness = await this.buildReadiness(election, user);
    const config = await this.getConfigByElection(election.id);
    const extra = this.asRecord(config.extra);

    return this.buildWizardState(election, readiness, extra.wizardProgress);
  }

  async updateWizard(
    id: string,
    user: User,
    body: { currentStep?: string; completedSteps?: string[] },
  ) {
    const election = await this.findElectionEntity(id, user);
    await this.ensureElectionManagementAccess(election, user);
    const config = await this.getConfigByElection(election.id);
    const extra = this.asRecord(config.extra);
    const currentStep = this.normalizeWizardStep(body?.currentStep, true);
    const completedSteps = Array.isArray(body?.completedSteps)
      ? Array.from(new Set(body.completedSteps.map((step) => this.normalizeWizardStep(step, false))))
      : undefined;
    const previous = this.asRecord(extra.wizardProgress);
    const now = new Date().toISOString();

    const wizardProgress = {
      currentStep: currentStep || previous.currentStep || 'basic_info',
      completedSteps: completedSteps || (Array.isArray(previous.completedSteps) ? previous.completedSteps : []),
      updatedAt: now,
      updatedBy: {
        id: user.id,
        name: user.fullName || user.email,
        email: user.email,
      },
    };

    config.extra = {
      ...extra,
      wizardProgress,
    };
    await this.configRepository.save(config);
    await this.safeLogElectionAction(election.id, TimelineAction.ELECTION_WIZARD_UPDATED, user, {
      currentStep: wizardProgress.currentStep,
      completedSteps: wizardProgress.completedSteps,
    });

    const readiness = await this.buildReadiness(election, user);
    return this.buildWizardState(election, readiness, wizardProgress);
  }

  async getSupervisionMembers(id: string, user: User) {
    const election = await this.findElectionEntity(id, user);
    const config = await this.getConfigByElection(election.id);
    const extra = this.asRecord(config.extra);
    let memberships = await this.membershipRepository.find({ where: { electionId: election.id } });
    if (!memberships.length) {
      const legacyMembers = this.normalizedSupervisionMembers(extra.supervisionMembers);
      memberships = await Promise.all(legacyMembers.map(async (member) => {
        const existingUser = member.userId
          ? await this.userRepository.findOne({ where: { id: member.userId } })
          : await this.userRepository.findOne({ where: { email: member.email } });
        return this.membershipRepository.save(this.membershipRepository.create({
          electionId: election.id,
          userId: existingUser?.id || null,
          email: member.email,
          name: member.name,
          role: member.role as ElectionMembershipRole,
          status: existingUser ? ElectionMembershipStatus.ACCEPTED : ElectionMembershipStatus.PENDING,
          invitedById: user.id,
          acceptedAt: existingUser ? new Date() : null,
        }));
      }));
    }

    return {
      electionId: election.id,
      members: memberships.filter((item) => item.status !== ElectionMembershipStatus.REVOKED).map((item) => ({
        id: item.id, userId: item.userId, email: item.email, name: item.name,
        role: item.role, status: item.status, addedAt: item.createdAt,
      })),
    };
  }

  async updateSupervisionMembers(id: string, user: User, body: { members?: unknown[] }) {
    const election = await this.findElectionEntity(id, user);
    await this.ensureElectionManagementAccess(election, user);
    const config = await this.getConfigByElection(election.id);
    const extra = this.asRecord(config.extra);
    const members = this.normalizedSupervisionMembers(body?.members).map((member) => ({
      ...member,
      addedAt: member.addedAt || new Date().toISOString(),
      addedBy: member.addedBy || {
        id: user.id,
        name: user.fullName || user.email,
        email: user.email,
      },
    }));

    const requestedEmails = new Set(members.map((member) => member.email));
    const currentMemberships = await this.membershipRepository.find({ where: { electionId: election.id } });
    for (const current of currentMemberships) {
      if (!requestedEmails.has(current.email) && current.status !== ElectionMembershipStatus.REVOKED) {
        current.status = ElectionMembershipStatus.REVOKED;
        current.revokedAt = new Date();
        await this.membershipRepository.save(current);
      }
    }
    const persistedMemberships: ElectionMembership[] = [];
    for (const member of members) {
      const existingUser = await this.userRepository.findOne({ where: { email: member.email } });
      let membership = currentMemberships.find((item) => item.email === member.email);
      const keepAccepted = Boolean(
        membership
        && membership.status === ElectionMembershipStatus.ACCEPTED
        && membership.userId === existingUser?.id
        && membership.role === member.role,
      );
      membership = membership || this.membershipRepository.create({ electionId: election.id, email: member.email });
      membership.name = member.name;
      membership.role = member.role as ElectionMembershipRole;
      membership.userId = existingUser?.id || null;
      membership.status = keepAccepted ? ElectionMembershipStatus.ACCEPTED : ElectionMembershipStatus.PENDING;
      membership.acceptedAt = keepAccepted ? membership.acceptedAt : null;
      membership.revokedAt = null;
      membership.invitedById = user.id;
      persistedMemberships.push(await this.membershipRepository.save(membership));
    }

    config.extra = {
      ...extra,
      supervisionMembers: members,
    };
    await this.configRepository.save(config);
    await this.safeLogElectionAction(election.id, TimelineAction.ELECTION_SUPERVISION_MEMBERS_UPDATED, user, {
      totalMembers: members.length,
      roles: members.reduce((acc, member) => {
        acc[member.role] = (acc[member.role] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    });

    return {
      electionId: election.id,
      members: persistedMemberships.map((item) => ({
        id: item.id, userId: item.userId, email: item.email, name: item.name,
        role: item.role, status: item.status, addedAt: item.createdAt,
      })),
    };
  }

  async getMyMembershipInvitations(user: User) {
    const email = String(user.email || '').trim().toLowerCase();
    const invitations = await this.membershipRepository.find({
      where: [
        { userId: user.id, status: ElectionMembershipStatus.PENDING },
        { email, status: ElectionMembershipStatus.PENDING },
      ],
      relations: { election: true },
      order: { createdAt: 'DESC' },
    });
    return invitations.map((membership) => ({
      id: membership.id,
      electionId: membership.electionId,
      electionTitle: membership.election?.title || 'Eleccion',
      role: membership.role,
      status: membership.status,
      invitedAt: membership.createdAt,
    }));
  }

  async respondToMembershipInvitation(id: string, user: User, accept: boolean) {
    const email = String(user.email || '').trim().toLowerCase();
    const membership = await this.membershipRepository.findOne({ where: { id }, relations: { election: true } });
    if (!membership || (membership.userId && membership.userId !== user.id) || membership.email !== email) {
      throw new NotFoundException('Invitacion no encontrada.');
    }
    if (membership.status !== ElectionMembershipStatus.PENDING) {
      throw new BadRequestException('La invitacion ya fue respondida.');
    }
    membership.userId = user.id;
    membership.status = accept ? ElectionMembershipStatus.ACCEPTED : ElectionMembershipStatus.REVOKED;
    membership.acceptedAt = accept ? new Date() : null;
    membership.revokedAt = accept ? null : new Date();
    await this.membershipRepository.save(membership);
    return {
      id: membership.id,
      electionId: membership.electionId,
      electionTitle: membership.election?.title || 'Eleccion',
      role: membership.role,
      status: membership.status,
    };
  }

  async setSectionApproval(
    id: string,
    user: User,
    section: string,
    status: ApprovalStatus,
    comment?: string,
  ) {
    const election = await this.findElectionEntity(id, user);
    await this.ensureElectionManagementAccess(election, user);
    if (election.status === StatusType.RUNNING || election.status === StatusType.COMPLETED) {
      throw new BadRequestException('Las aprobaciones no se pueden modificar una vez iniciada la eleccion.');
    }
    const normalizedSection = this.normalizeApprovalSection(section);
    const normalizedStatus = this.normalizeApprovalStatus(status);
    const config = await this.getConfigByElection(election.id);
    const extra = this.asRecord(config.extra);
    const approvals = this.asRecord(extra.approvals);
    const now = new Date().toISOString();

    approvals[normalizedSection] = {
      section: normalizedSection,
      status: normalizedStatus,
      comment: String(comment || '').trim() || null,
      reviewedAt: now,
      reviewedBy: {
        id: user.id,
        name: user.fullName || user.email,
        email: user.email,
        roles: user.roles || [],
      },
    };

    config.extra = {
      ...extra,
      approvals,
    };
    await this.configRepository.save(config);

    await this.safeLogElectionAction(
      election.id,
      normalizedStatus === 'approved'
        ? TimelineAction.ELECTION_SECTION_APPROVED
        : TimelineAction.ELECTION_SECTION_REJECTED,
      user,
      {
        section: normalizedSection,
        status: normalizedStatus,
        comment: String(comment || '').trim() || null,
      },
    );

    return this.buildReadiness(election, user);
  }

  async getAuditPackage(id: string, user: User) {
    const election = await this.findElectionEntity(id, user);
    const [readiness, results, config, voterRollEvidence, receiptEvidence] = await Promise.all([
      this.buildReadiness(election, user),
      this.getResults(election.id, user, 'real'),
      this.getConfigByElection(election.id),
      this.getVoterRollEvidence(election.id),
      this.getReceiptEvidence(election.id),
    ]);
    const events = await this.timeline.getTimelineBy(election.id);
    const packageData = {
      generatedAt: new Date().toISOString(),
      generatedBy: {
        id: user.id,
        name: user.fullName || user.email,
        email: user.email,
      },
      election: {
        id: election.id,
        title: election.title,
        description: election.description,
        status: election.status,
        startDate: election.startDate,
        endDate: election.endDate,
      },
      config: this.sanitizeConfigForAudit(config),
      voterRoll: voterRollEvidence,
      receipts: receiptEvidence,
      identityVoteSeparation: {
        statement: 'El paquete registra participacion y recibos verificables sin exponer seleccion individual.',
        document: 'docs/identity-vote-separation.md',
      },
      readiness,
      results,
      events: events.map((event: any) => ({
        id: String(event?._id || ''),
        action: event.action,
        electionId: event.electionId,
        entityId: event.entityId,
        createdAt: event.createdAt,
        metadata: event.metadata || {},
      })),
    };

    const evidence = {
      ...packageData,
      hashes: {
        config: this.hashEvidence(packageData.config),
        readiness: this.hashEvidence(packageData.readiness),
        results: this.hashEvidence(packageData.results),
        events: this.hashEvidence(packageData.events),
        voterRoll: voterRollEvidence.hash,
        receipts: receiptEvidence.hash,
      },
    };

    await this.safeLogElectionAction(election.id, TimelineAction.ELECTION_AUDIT_PACKAGE_EXPORTED, user, {
      hashes: evidence.hashes,
    });

    return evidence;
  }

  async getAuditPackageCsv(id: string, user: User) {
    const evidence = await this.getAuditPackage(id, user);
    const rows = [
      ['section', 'key', 'value'],
      ['election', 'id', evidence.election.id],
      ['election', 'title', evidence.election.title],
      ['election', 'status', evidence.election.status || ''],
      ['readiness', 'ready', String(evidence.readiness.ready)],
      ['readiness', 'completionPct', String(evidence.readiness.completionPct)],
      ['results', 'totalVoters', String(evidence.results.totalVoters)],
      ['results', 'totalVotes', String(evidence.results.totalVotes)],
      ['results', 'votersWhoVoted', String(evidence.results.votersWhoVoted)],
      ['results', 'participationPct', String(evidence.results.participationPct)],
      ['hashes', 'config', evidence.hashes.config],
      ['hashes', 'readiness', evidence.hashes.readiness],
      ['hashes', 'results', evidence.hashes.results],
      ['hashes', 'events', evidence.hashes.events],
      ['hashes', 'voterRoll', evidence.hashes.voterRoll],
      ['hashes', 'receipts', evidence.hashes.receipts],
      ['receipts', 'includedCodes', String(evidence.receipts.totalReceipts)],
    ];

    evidence.readiness.requirements.forEach((item) => {
      rows.push(['requirement', item.key, item.done ? 'complete' : 'pending']);
    });
    evidence.readiness.approvals.forEach((item) => {
      rows.push(['approval', item.section, item.status]);
    });

    return rows.map((row) => row.map((value) => this.csvEscape(value)).join(',')).join('\n');
  }

  async getAuditPackagePdf(id: string, user: User): Promise<Buffer> {
    const evidence = await this.getAuditPackage(id, user);
    const lines = [
      'Voting Suite - Paquete de Auditoria',
      `Generado: ${evidence.generatedAt}`,
      `Generado por: ${evidence.generatedBy?.name || evidence.generatedBy?.email || ''}`,
      '',
      'Eleccion',
      `ID: ${evidence.election.id}`,
      `Titulo: ${evidence.election.title}`,
      `Estado: ${evidence.election.status || ''}`,
      `Inicio: ${evidence.election.startDate || evidence.config?.startAt || ''}`,
      `Fin: ${evidence.election.endDate || evidence.config?.endAt || ''}`,
      '',
      'Preparacion',
      `Lista para produccion: ${evidence.readiness.ready ? 'Si' : 'No'}`,
      `Avance: ${evidence.readiness.completionPct}%`,
      ...evidence.readiness.requirements.map((item) => {
        return `- ${item.done ? '[OK]' : '[PENDIENTE]'} ${item.label}`;
      }),
      '',
      'Aprobaciones',
      ...evidence.readiness.approvals.map((item) => {
        return `- ${item.section}: ${item.status}${item.reviewedAt ? ` (${item.reviewedAt})` : ''}`;
      }),
      '',
      'Resultados',
      `Padron: ${evidence.results.totalVoters}`,
      `Votos: ${evidence.results.totalVotes}`,
      `Votantes que votaron: ${evidence.results.votersWhoVoted}`,
      `Participacion: ${evidence.results.participationPct}%`,
      '',
      'Hashes de Evidencia',
      `Config: ${evidence.hashes.config}`,
      `Readiness: ${evidence.hashes.readiness}`,
      `Results: ${evidence.hashes.results}`,
      `Events: ${evidence.hashes.events}`,
      `Padron: ${evidence.hashes.voterRoll}`,
      `Recibos: ${evidence.hashes.receipts}`,
      `Codigos de recibo incluidos: ${evidence.receipts.totalReceipts}`,
      '',
      'Eventos',
      ...evidence.events.slice(0, 120).map((event) => {
        return `- ${event.createdAt || ''} ${event.action || ''} ${event.entityId || ''}`;
      }),
    ];

    return this.buildSimplePdf(lines);
  }

  async update(id: string, updateElectionDto: UpdateElectionDto, user: User) {
    const election = await this.findElectionEntity(id, user);

    const mergedElection = this.electionRepository.merge(election, {
      ...updateElectionDto,
    });

    if (
      updateElectionDto.status === StatusType.RUNNING ||
      updateElectionDto.status === StatusType.COMPLETED
    ) {
      const votersCount = await this.votersService.votersCountOfElection(election.id);
      const optionsCount = await this.countOptionsOfElection(election.id);

      if (votersCount <= 0 || optionsCount <= 0) {
        throw new BadRequestException(
          updateElectionDto.status === StatusType.COMPLETED
            ? 'No se puede completar una eleccion incompleta. Debes registrar al menos una opcion de votacion y un votante.'
            : 'Para iniciar la eleccion, debes registrar al menos una opcion de votacion y un votante.',
        );
      }

      if (updateElectionDto.status === StatusType.RUNNING) {
        const endDate = updateElectionDto.endDate || election.endDate;
        if (endDate && new Date(endDate).getTime() <= Date.now()) {
          throw new BadRequestException(
            'La fecha estimada de finalizacion ya paso. Actualizala antes de iniciar la eleccion.',
          );
        }
      }
    }

    //Create queryRunner
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.manager.save(mergedElection);
      await queryRunner.commitTransaction();
      await queryRunner.release();

      // await this.productRepository.save(product);
      return mergedElection;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      await queryRunner.release();
      this.handleDBExceptions(error);
    }
  }

  async startDemo(id: string, user: User) {
    const election = await this.findElectionEntity(id, user);
    await this.ensureElectionManagementAccess(election, user);
    if (election.status === StatusType.RUNNING) {
      throw new BadRequestException('Una eleccion en curso no puede iniciar un demo.');
    }
    await this.ensureElectionCanRun(election.id, 'Para iniciar el demo, debes registrar al menos una opcion de votacion y un votante.');

    const config = await this.getConfigByElection(election.id);
    config.runMode = ElectionRunMode.DEMO;
    await this.configRepository.save(config);

    const updated = this.electionRepository.merge(election, {
      status: StatusType.RUNNING,
      updatedAt: new Date(),
    });
    const saved = await this.electionRepository.save(updated);
    await this.safeLogElectionAction(election.id, TimelineAction.ELECTION_DEMO_STARTED, user, {
      runMode: ElectionRunMode.DEMO,
    });
    return saved;
  }

  async clearDemo(id: string, user: User) {
    const election = await this.findElectionEntity(id, user);
    await this.ensureElectionManagementAccess(election, user);
    const result = await this.voteRepository
      .createQueryBuilder()
      .softDelete()
      .from(Vote)
      .where(
        `"isDemo" = true AND "optionId" IN (
          SELECT option_entity.id
          FROM options option_entity
          LEFT JOIN questions question_entity ON question_entity.id = option_entity."questionId"
          WHERE option_entity."electionId" = :electionId
            OR question_entity."electionId" = :electionId
        )`,
        { electionId: election.id },
      )
      .execute();

    const response = {
      message: 'Datos demo eliminados correctamente',
      deleted: result.affected ?? 0,
    };
    await this.safeLogElectionAction(election.id, TimelineAction.ELECTION_DEMO_CLEARED, user, response);
    return response;
  }

  async completeDemo(id: string, user: User, notes?: string) {
    const election = await this.findElectionEntity(id, user);
    await this.ensureElectionManagementAccess(election, user);
    const config = await this.getConfigByElection(election.id);
    const extra = this.asRecord(config.extra);
    const now = new Date().toISOString();
    const demoReview = {
      status: 'completed',
      completedAt: now,
      notes: String(notes || '').trim() || null,
      completedBy: {
        id: user.id,
        name: user.fullName || user.email,
        email: user.email,
      },
    };

    config.extra = {
      ...extra,
      demoReview,
    };
    await this.configRepository.save(config);
    await this.safeLogElectionAction(election.id, TimelineAction.ELECTION_DEMO_COMPLETED, user, demoReview);

    return {
      electionId: election.id,
      demoReview,
    };
  }

  async generateDemoLink(id: string, user: User, ttlMinutes = 60) {
    const election = await this.findElectionEntity(id, user);
    await this.ensureElectionManagementAccess(election, user);
    const existingConfig = await this.getConfigByElection(election.id);
    if (election.status === StatusType.RUNNING && existingConfig.runMode === ElectionRunMode.PRODUCTION) {
      throw new BadRequestException('Una eleccion en curso no puede habilitar accesos demo.');
    }
    await this.ensureElectionCanRun(election.id, 'Para generar un enlace demo, debes registrar al menos una opcion de votacion y un votante.');

    const normalizedTtl = this.normalizeDemoLinkTtl(ttlMinutes);
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + normalizedTtl * 60 * 1000).toISOString();
    const config = await this.getConfigByElection(election.id);
    const extra = this.asRecord(config.extra);

    config.runMode = ElectionRunMode.DEMO;
    config.extra = {
      ...extra,
      demoLink: {
        tokenHash: this.hashDemoToken(token),
        expiresAt,
        createdAt: new Date().toISOString(),
      },
    };
    await this.configRepository.save(config);

    if (election.status !== StatusType.RUNNING) {
      await this.electionRepository.update(election.id, {
        status: StatusType.RUNNING,
        updatedAt: new Date(),
      });
    }

    return {
      electionId: election.id,
      token,
      expiresAt,
      ttlMinutes: normalizedTtl,
    };
  }

  async startProduction(id: string, user: User) {
    const election = await this.findElectionEntity(id, user);
    await this.ensureElectionManagementAccess(election, user);
    await this.ensureReadyForProduction(election, user);

    const endDate = election.endDate;
    if (endDate && new Date(endDate).getTime() <= Date.now()) {
      throw new BadRequestException(
        'La fecha estimada de finalizacion ya paso. Actualizala antes de iniciar la eleccion.',
      );
    }

    const config = await this.getConfigByElection(election.id);
    config.runMode = ElectionRunMode.PRODUCTION;
    const configExtra = this.asRecord(config.extra);
    const { automaticStartBlocked: _automaticStartBlocked, ...restExtra } = configExtra;
    config.extra = restExtra;
    await this.configRepository.save(config);

    const updated = this.electionRepository.merge(election, {
      status: StatusType.RUNNING,
      updatedAt: new Date(),
    });
    const saved = await this.electionRepository.save(updated);
    await this.safeLogElectionAction(election.id, TimelineAction.ELECTION_PRODUCTION_STARTED, user, {
      runMode: ElectionRunMode.PRODUCTION,
    });
    return saved;
  }

  async closeElection(id: string, user: User) {
    const election = await this.findElectionEntity(id, user);
    await this.ensureElectionManagementAccess(election, user);
    if (election.status === StatusType.COMPLETED) {
      return election;
    }

    const updated = this.electionRepository.merge(election, {
      status: StatusType.COMPLETED,
      endDate: election.endDate || new Date(),
      updatedAt: new Date(),
    });
    const saved = await this.electionRepository.save(updated);
    await this.safeLogElectionAction(election.id, TimelineAction.ELECTION_CLOSED, user, {
      status: StatusType.COMPLETED,
      closedAt: new Date().toISOString(),
    });
    return saved;
  }

  async getScrutiny(id: string, user: User) {
    const election = await this.findElectionEntity(id, user);
    const [readiness, results, config, events] = await Promise.all([
      this.buildReadiness(election, user),
      this.getResults(election.id, user, 'real'),
      this.getConfigByElection(election.id),
      this.timeline.getTimelineBy(election.id),
    ]);
    const extra = this.asRecord(config.extra);
    const scrutinyPublication = this.asRecord(extra.scrutinyPublication);
    const blockers = [
      ...readiness.requirements.filter((item) => !item.done).map((item) => item.label),
      ...readiness.approvals.filter((item) => item.status !== 'approved').map((item) => `Aprobacion: ${item.section}`),
    ];

    return {
      election: {
        id: election.id,
        title: election.title,
        status: election.status,
        startDate: election.startDate,
        endDate: election.endDate,
      },
      generatedAt: new Date().toISOString(),
      canClose: election.status === StatusType.RUNNING || election.status === StatusType.ACTIVE,
      canPublish: election.status === StatusType.COMPLETED && blockers.length === 0,
      blockers,
      readiness,
      results,
      publication: {
        status: scrutinyPublication.status || 'pending',
        publishedAt: scrutinyPublication.publishedAt || null,
        publishedBy: scrutinyPublication.publishedBy || null,
        notes: scrutinyPublication.notes || null,
      },
      audit: {
        eventsCount: events.length,
        lastEventAt: events[0]?.createdAt || null,
      },
    };
  }

  async publishScrutiny(id: string, user: User, notes?: string) {
    const election = await this.findElectionEntity(id, user);
    await this.ensureElectionManagementAccess(election, user);
    if (election.status !== StatusType.COMPLETED) {
      throw new BadRequestException('El escrutinio solo puede publicarse cuando la eleccion esta cerrada.');
    }

    const scrutiny = await this.getScrutiny(election.id, user);
    if (scrutiny.blockers.length) {
      throw new BadRequestException(`No se puede publicar escrutinio. Pendiente: ${scrutiny.blockers.join(', ')}.`);
    }

    const config = await this.getConfigByElection(election.id);
    const extra = this.asRecord(config.extra);
    const publication = {
      status: 'published',
      publishedAt: new Date().toISOString(),
      notes: String(notes || '').trim() || null,
      publishedBy: {
        id: user.id,
        name: user.fullName || user.email,
        email: user.email,
      },
      hashes: {
        results: this.hashEvidence(scrutiny.results),
        readiness: this.hashEvidence(scrutiny.readiness),
      },
    };

    config.extra = {
      ...extra,
      scrutinyPublication: publication,
    };
    await this.configRepository.save(config);
    await this.safeLogElectionAction(election.id, TimelineAction.ELECTION_SCRUTINY_PUBLISHED, user, publication);

    return this.getScrutiny(election.id, user);
  }

  async getCommunicationTemplates(id: string, user: User) {
    const election = await this.findElectionEntity(id, user);
    const config = await this.getConfigByElection(election.id);
    const extra = this.asRecord(config.extra);
    return {
      electionId: election.id,
      templates: this.normalizedCommunicationTemplates(extra.communicationTemplates),
    };
  }

  async updateCommunicationTemplates(id: string, user: User, body: Record<string, unknown>) {
    const election = await this.findElectionEntity(id, user);
    await this.ensureElectionManagementAccess(election, user);
    const config = await this.getConfigByElection(election.id);
    const extra = this.asRecord(config.extra);
    const templates = this.normalizedCommunicationTemplates(body?.templates ?? body, true);

    config.extra = {
      ...extra,
      communicationTemplates: templates,
    };
    await this.configRepository.save(config);
    await this.safeLogElectionAction(election.id, TimelineAction.ELECTION_COMMUNICATION_TEMPLATES_UPDATED, user, {
      keys: Object.keys(templates).filter((key) => {
        const template = templates[key as CommunicationTemplateKey];
        return template.subject || template.body;
      }),
    });

    return {
      electionId: election.id,
      templates,
    };
  }

  async remove(id: string, user: User) {
    const election = await this.findElectionEntity(id, user);
    if (election.status === StatusType.RUNNING) {
      throw new BadRequestException('Una eleccion en curso no puede eliminarse. Debes finalizarla primero.');
    }
    await this.electionRepository.softRemove(election);
    return { message: `Election with id ${id} archived` };
  }

  async permanentlyRemove(id: string, user: User) {
    const election = await this.findElectionEntity(id, user);
    if (election.status !== StatusType.INCOMPLETE) {
      throw new BadRequestException(
        'Solo se pueden eliminar definitivamente elecciones incompletas. Archiva las elecciones publicadas o finalizadas para conservar su historial.',
      );
    }

    const voters = await this.voterRepository.count({ where: { election: { id: election.id } } });
    const votes = await this.voteRepository
      .createQueryBuilder('vote')
      .innerJoin('vote.voter', 'voter')
      .where('voter.electionId = :electionId', { electionId: election.id })
      .getCount();

    if (voters > 0 || votes > 0) {
      throw new BadRequestException(
        'Solo se pueden eliminar definitivamente elecciones sin votantes registrados ni votos emitidos.',
      );
    }

    const purchases = await this.dataSource
      .getRepository(PlanPurchase)
      .createQueryBuilder('purchase')
      .where('purchase.electionId = :electionId', { electionId: election.id })
      .getCount();

    if (purchases > 0) {
      throw new BadRequestException(
        'No se puede eliminar definitivamente una elección con registros de facturación asociados.',
      );
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(Election).remove(election);
    });

    return { message: `Election with id ${id} permanently deleted` };
  }

  async duplicate(id: string, user: User) {
    const source = await this.findElectionEntity(id, user);
    await this.ensureElectionManagementAccess(source, user);

    return this.dataSource.transaction(async (manager) => {
      const electionRepository = manager.getRepository(Election);
      const configRepository = manager.getRepository(ElectionConfig);
      const questionRepository = manager.getRepository(Question);
      const optionRepository = manager.getRepository(Options);
      const sourceConfig = await configRepository.findOne({ where: { electionId: source.id } });
      const sourceQuestions = await questionRepository.find({
        where: { election: { id: source.id }, userId: user.id },
        relations: ['options'],
        order: { order: 'ASC' },
      });

      const copy = await electionRepository.save(electionRepository.create({
        title: `${source.title} (copia)`,
        description: source.description,
        status: StatusType.INCOMPLETE,
        startDate: null,
        endDate: null,
        user,
      }));

      if (sourceConfig) {
        const sourceExtra = this.asRecord(sourceConfig.extra);
        const {
          approvals: _approvals,
          demoLink: _demoLink,
          demoReview: _demoReview,
          wizardProgress: _wizardProgress,
          scrutinyPublication: _scrutinyPublication,
          automaticStartBlocked: _automaticStartBlocked,
          ...reusableExtra
        } = sourceExtra;
        await configRepository.save(configRepository.create({
          election: copy,
          electionId: copy.id,
          user,
          userId: user.id,
          startAt: null,
          endAt: null,
          timezone: sourceConfig.timezone,
          votingMode: sourceConfig.votingMode,
          maxVotesPerVoter: sourceConfig.maxVotesPerVoter,
          allowMultipleSelections: sourceConfig.allowMultipleSelections,
          requireAuthentication: sourceConfig.requireAuthentication,
          anonymousVoting: sourceConfig.anonymousVoting,
          logoUrl: sourceConfig.logoUrl,
          theme: sourceConfig.theme,
          resultVisibility: sourceConfig.resultVisibility,
          tieBreaker: sourceConfig.tieBreaker,
          runMode: ElectionRunMode.PRODUCTION,
          allowWriteIns: sourceConfig.allowWriteIns,
          allowReceiptDownload: sourceConfig.allowReceiptDownload,
          extra: reusableExtra,
        }));
      }

      for (const sourceQuestion of sourceQuestions) {
        const question = await questionRepository.save(questionRepository.create({
          title: sourceQuestion.title,
          description: sourceQuestion.description,
          order: sourceQuestion.order,
          minSelect: sourceQuestion.minSelect,
          maxSelect: sourceQuestion.maxSelect,
          type: sourceQuestion.type,
          election: copy,
          user,
          userId: user.id,
        }));
        const options = (sourceQuestion.options || []).map((sourceOption) => optionRepository.create({
          title: sourceOption.title,
          description: sourceOption.description,
          order: sourceOption.order,
          images: sourceOption.images,
          files: sourceOption.files,
          type: sourceOption.type,
          election: copy,
          question,
          user,
          userId: user.id,
        }));
        if (options.length) await optionRepository.save(options);
      }

      return copy;
    });
  }

  async getResults(electionId: string, user: User, scope?: string) {
    const election = await this.findElectionEntity(electionId, user);

    const config = await this.configRepository.findOne({
      where: { electionId: election.id },
      select: ['startAt', 'tieBreaker', 'runMode'],
    });
    const resultScope = this.resolveResultsScope(scope, config?.runMode);
    const voteFilter = resultScope === 'DEMO' ? 'vote.isDemo = true' : 'vote.isDemo = false';
    const participationQuery = this.voterRepository
      .createQueryBuilder('voter')
      .innerJoin('voter.election', 'election')
      .leftJoin(
        'voter.votes',
        'participationVote',
        'participationVote.isDemo = :participationIsDemo',
        { participationIsDemo: resultScope === 'DEMO' },
      )
      .select('COUNT(DISTINCT voter.id)', 'totalVoters')
      .where('election.id = :electionId', { electionId: election.id });

    participationQuery.addSelect(
      resultScope === 'DEMO'
        ? 'COUNT(DISTINCT CASE WHEN participationVote.id IS NOT NULL THEN voter.id END)'
        : 'COUNT(DISTINCT CASE WHEN voter.vote = true OR participationVote.id IS NOT NULL THEN voter.id END)',
      'votersWhoVoted',
    );
    const participationRaw = await participationQuery.getRawOne();
    const totalVoters = Number(participationRaw?.totalVoters ?? 0);
    const votersWhoVoted = Number(participationRaw?.votersWhoVoted ?? 0);

    const votesByOptionRaw = await this.optionsRepository
      .createQueryBuilder('option')
      .leftJoin('option.votes', 'vote', voteFilter)
      .leftJoin('option.question', 'question')
      .select('option.id', 'id')
      .addSelect('option.title', 'title')
      .addSelect('option.description', 'description')
      .addSelect('option.order', 'order')
      .addSelect('COUNT(vote.id)', 'votes')
      .where('question.electionId = :electionId', { electionId: election.id })
      .groupBy('option.id')
      .addGroupBy('option.title')
      .addGroupBy('option.description')
      .addGroupBy('option.order')
      .orderBy('option.order', 'ASC')
      .getRawMany();

    const votesByOption = votesByOptionRaw.map((row) => ({
      id: row.id as string,
      title: row.title as string,
      description: row.description as string | null,
      order: Number(row.order ?? 0),
      votes: Number(row.votes ?? 0),
    }));

    const totalVotes = votesByOption.reduce(
      (sum, option) => sum + option.votes,
      0,
    );

    const participationPct =
      totalVoters > 0
        ? Number(((votersWhoVoted / totalVoters) * 100).toFixed(1))
        : 0;

    const turnoutRaw = await this.voteRepository
      .createQueryBuilder('vote')
      .innerJoin('vote.option', 'option')
      .innerJoin('option.question', 'question')
      .select("DATE_TRUNC('hour', vote.votedAt)", 'bucket')
      .addSelect('COUNT(*)', 'count')
      .where('question.electionId = :electionId', { electionId: election.id })
      .andWhere(voteFilter)
      .groupBy('bucket')
      .orderBy('bucket', 'ASC')
      .getRawMany();

    const lastVoteRaw = await this.voteRepository
      .createQueryBuilder('vote')
      .innerJoin('vote.option', 'option')
      .innerJoin('option.question', 'question')
      .select('MAX(vote.votedAt)', 'lastVoteAt')
      .where('question.electionId = :electionId', { electionId: election.id })
      .andWhere(voteFilter)
      .getRawOne();

    const demoVotesRaw = await this.voteRepository
      .createQueryBuilder('vote')
      .innerJoin('vote.option', 'option')
      .innerJoin('option.question', 'question')
      .select('COUNT(vote.id)', 'count')
      .where('question.electionId = :electionId', { electionId: election.id })
      .andWhere('vote.isDemo = true')
      .getRawOne();

    const demoVotesExcluded = resultScope === 'DEMO' ? 0 : Number(demoVotesRaw?.count ?? 0);

    const startAt = config?.startAt || election.startDate || null;

    let avgVoteSecondsFromStart: number | null = null;
    if (startAt) {
      const avgRaw = await this.voteRepository
        .createQueryBuilder('vote')
        .innerJoin('vote.option', 'option')
        .innerJoin('option.question', 'question')
        .select('AVG(EXTRACT(EPOCH FROM (vote.votedAt - :startAt)))', 'avg')
        .where('question.electionId = :electionId', { electionId: election.id })
        .andWhere(voteFilter)
        .setParameter('startAt', startAt)
        .getRawOne();

      const avgValue = Number(avgRaw?.avg);
      avgVoteSecondsFromStart = Number.isFinite(avgValue)
        ? Math.max(0, avgValue)
        : null;
    }

    const processedPct =
      totalVoters > 0
        ? Number(((votersWhoVoted / totalVoters) * 100).toFixed(1))
        : 0;
    const pendingPct =
      totalVoters > 0 ? Number((100 - processedPct).toFixed(1)) : 0;

    let hotspots: Array<{ lat: number; lng: number; votes: number; address?: string | null }> = [];
    try {
      hotspots = await this.timeline.getVoteHotspotsByElection(election.id, 0, resultScope);
    } catch (error) {
      this.logger.warn(
        `Could not load vote hotspots: ${error?.message || error}`,
      );
    }
    if (!hotspots.length) {
      hotspots = await this.getVoteHotspotsFromVoterMetadata(election.id, resultScope);
    }

    const tieResolution = this.resolveTieBreaker(
      election.id,
      votesByOption,
      config?.tieBreaker ?? TieBreaker.RANDOM,
    );

    return {
      electionId: election.id,
      electionTitle: election.title,
      runMode: config?.runMode ?? null,
      resultScope,
      excludesDemo: resultScope !== 'DEMO',
      demoVotesExcluded,
      totalVoters,
      totalVotes,
      ballotsCast: votersWhoVoted,
      votersWhoVoted,
      participationPct,
      votesByOption,
      turnout: turnoutRaw.map((row) => ({
        bucket: row.bucket,
        count: Number(row.count ?? 0),
      })),
      status: {
        processed: processedPct,
        pending: pendingPct < 0 ? 0 : pendingPct,
        observed: 0,
      },
      tieResolution,
      hotspots,
      lastVoteAt: lastVoteRaw?.lastVoteAt || null,
      avgVoteSecondsFromStart,
    };
  }

  async getFraudSignals(
    electionId: string,
    user: User,
    options: { page?: number; pageSize?: number; filter?: 'all' | 'suspicious' } = {},
  ) {
    const election = await this.findElectionEntity(electionId, user);
    return this.timeline.getFraudSignalsByElection(election.id, options);
  }

  private async getVoteHotspotsFromVoterMetadata(
    electionId: string,
    resultScope: 'REAL' | 'DEMO',
  ): Promise<Array<{ lat: number; lng: number; votes: number; address?: string | null }>> {
    const rows = await this.voteRepository
      .createQueryBuilder('vote')
      .innerJoin('vote.voter', 'voter')
      .innerJoin('vote.option', 'option')
      .innerJoin('option.question', 'question')
      .select('voter.id', 'voterId')
      .addSelect('voter.metadata', 'metadata')
      .addSelect('COUNT(vote.id)', 'votes')
      .where('question.electionId = :electionId', { electionId })
      .andWhere('vote.isDemo = :isDemo', { isDemo: resultScope === 'DEMO' })
      .groupBy('voter.id')
      .addGroupBy('voter.metadata')
      .getRawMany();

    const grouped = new Map<string, { lat: number; lng: number; votes: number; address?: string | null }>();
    for (const row of rows) {
      const metadata = this.asRecord(row?.metadata);
      const coords = this.extractCoordinates(metadata);
      if (!coords) continue;
      const lat = Number(coords.lat.toFixed(4));
      const lng = Number(coords.lng.toFixed(4));
      const key = `${lat}|${lng}`;
      const existing = grouped.get(key);
      const votes = Number(row?.votes || 0);
      if (existing) {
        existing.votes += votes;
        if (!existing.address && coords.address) existing.address = coords.address;
      } else {
        grouped.set(key, { lat, lng, votes, address: coords.address || null });
      }
    }

    return Array.from(grouped.values()).sort((a, b) => b.votes - a.votes);
  }

  private extractCoordinates(metadata: Record<string, any>): { lat: number; lng: number; address?: string | null } | null {
    const candidates = [
      this.asRecord(metadata.coords),
      this.asRecord(this.asRecord(metadata.meta).coords),
      this.asRecord(metadata.location),
      metadata,
    ];

    for (const candidate of candidates) {
      const lat = this.asFiniteNumber(candidate.lat ?? candidate.latitude);
      const lng = this.asFiniteNumber(candidate.lng ?? candidate.lon ?? candidate.longitude);
      if (lat === null || lng === null) continue;
      if (Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;
      const address = this.normalizeLocationAddress(candidate.address ?? metadata.address);
      return { lat, lng, address: address || null };
    }
    return null;
  }

  private asFiniteNumber(value: unknown): number | null {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private normalizeLocationAddress(value: unknown): string {
    if (typeof value === 'string') return value.trim();
    const address = this.asRecord(value);
    for (const key of ['formattedAddress', 'formatted_address', 'displayName', 'display_name', 'label', 'name']) {
      const candidate = address[key];
      if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
    }
    return ['road', 'suburb', 'city', 'state', 'country']
      .map((key) => address[key])
      .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
      .map((part) => part.trim())
      .join(', ');
  }

  private resolveResultsScope(scope: unknown, runMode?: ElectionRunMode | null): 'REAL' | 'DEMO' {
    const normalized = typeof scope === 'string' ? scope.trim().toLowerCase() : '';
    if (normalized === 'demo') return 'DEMO';
    if (normalized === 'real') return 'REAL';
    return runMode === ElectionRunMode.DEMO ? 'DEMO' : 'REAL';
  }

  private resolveTieBreaker(
    electionId: string,
    votesByOption: Array<{ id: string; title: string; order: number; votes: number }>,
    tieBreaker: TieBreaker,
  ) {
    const maxVotes = votesByOption.reduce((max, option) => Math.max(max, option.votes), 0);
    const tied = votesByOption.filter((option) => option.votes === maxVotes);
    const hasTie = maxVotes > 0 && tied.length > 1;

    if (!hasTie) {
      return {
        method: tieBreaker,
        hasTie: false,
        requiresRunoff: false,
        winnerOptionId: tied[0]?.id || null,
        winnerOptionTitle: tied[0]?.title || null,
        tiedOptionIds: tied.map((option) => option.id),
        reason: 'No existe empate en el primer lugar.',
      };
    }

    if (tieBreaker === TieBreaker.RUNOFF) {
      return {
        method: tieBreaker,
        hasTie: true,
        requiresRunoff: true,
        winnerOptionId: null,
        winnerOptionTitle: null,
        tiedOptionIds: tied.map((option) => option.id),
        reason: 'Empate detectado: se requiere segunda vuelta para definir ganador.',
      };
    }

    if (tieBreaker === TieBreaker.BY_LEAST_ERRORS) {
      const winner = [...tied].sort((a, b) => {
        const byOrder = (a.order || 0) - (b.order || 0);
        if (byOrder !== 0) return byOrder;
        return a.title.localeCompare(b.title);
      })[0];

      return {
        method: tieBreaker,
        hasTie: true,
        requiresRunoff: false,
        winnerOptionId: winner?.id || null,
        winnerOptionTitle: winner?.title || null,
        tiedOptionIds: tied.map((option) => option.id),
        reason:
          'Empate resuelto por regla de menor error: prioridad por orden de boleta y luego por titulo.',
      };
    }

    const winner = this.pickDeterministicRandom(tied, electionId);
    return {
      method: tieBreaker,
      hasTie: true,
      requiresRunoff: false,
      winnerOptionId: winner?.id || null,
      winnerOptionTitle: winner?.title || null,
      tiedOptionIds: tied.map((option) => option.id),
      reason: 'Empate resuelto por seleccion aleatoria deterministica.',
    };
  }

  private pickDeterministicRandom<T extends { id: string }>(items: T[], seed: string): T | null {
    if (!items.length) return null;
    const hash = seed
      .split('')
      .reduce((acc, char, index) => acc + char.charCodeAt(0) * (index + 1), 0);
    const idx = hash % items.length;
    return items[idx] || null;
  }

  private async ensureElectionCanRun(electionId: string, message: string): Promise<void> {
    const [votersCount, optionsCount] = await Promise.all([
      this.votersService.votersCountOfElection(electionId),
      this.countOptionsOfElection(electionId),
    ]);

    if (votersCount <= 0 || optionsCount <= 0) {
      throw new BadRequestException(message);
    }
  }

  private async countOptionsOfElection(electionId: string): Promise<number> {
    return this.optionsRepository
      .createQueryBuilder('option')
      .leftJoin('option.question', 'question')
      .leftJoin('option.election', 'election')
      .where('question.electionId = :electionId OR election.id = :electionId', { electionId })
      .getCount();
  }

  private normalizeDemoLinkTtl(value: unknown): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 60;
    return Math.max(5, Math.min(1440, Math.round(parsed)));
  }

  private hashDemoToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private asRecord(value: unknown): Record<string, any> {
    return value && typeof value === 'object' ? (value as Record<string, any>) : {};
  }

  private normalizedCommunicationTemplates(value: unknown, touchUpdatedAt = false) {
    const source = this.asRecord(value);
    const keys: CommunicationTemplateKey[] = ['invitation', 'reminder', 'receipt'];
    return keys.reduce((templates, key) => {
      const entry = this.asRecord(source[key]);
      templates[key] = {
        subject: String(entry.subject || '').trim(),
        body: String(entry.body || '').trim(),
        updatedAt: entry.updatedAt || null,
      };
      if (touchUpdatedAt && (templates[key].subject || templates[key].body)) {
        templates[key].updatedAt = new Date().toISOString();
      }
      return templates;
    }, {} as Record<CommunicationTemplateKey, { subject: string; body: string; updatedAt: string | null }>);
  }

  private normalizeWizardStep(step: unknown, optional = false): WizardStepKey | '' {
    const normalized = String(step || '').trim().toLowerCase();
    const allowed: WizardStepKey[] = [
      'basic_info',
      'schedule',
      'authentication',
      'voters',
      'ballot',
      'rules',
      'demo',
      'approval',
      'publication',
    ];
    if (allowed.includes(normalized as WizardStepKey)) return normalized as WizardStepKey;
    if (optional && !normalized) return '';
    throw new BadRequestException('Paso de asistente invalido.');
  }

  private buildWizardState(election: Election, readiness: any, persisted: unknown) {
    const progress = this.asRecord(persisted);
    const persistedCompleted = new Set(
      Array.isArray(progress.completedSteps)
        ? progress.completedSteps
            .map((step) => {
              try {
                return this.normalizeWizardStep(step, true);
              } catch {
                return '';
              }
            })
            .filter(Boolean)
        : [],
    );
    const requirementMap = new Map<string, { done: boolean; evidence?: any }>(
      (readiness.requirements || []).map((item) => [item.key, item]),
    );
    const approvalsComplete = Boolean(readiness.summary?.requiredApprovalsComplete);
    const requirementDone = (...keys: string[]) => keys.every((key) => Boolean(requirementMap.get(key)?.done));
    const stepDefinitions: Array<{ key: WizardStepKey; label: string; done: boolean; evidence: any }> = [
      {
        key: 'basic_info',
        label: 'Datos basicos de eleccion',
        done: requirementDone('basic_info'),
        evidence: requirementMap.get('basic_info')?.evidence || {},
      },
      {
        key: 'schedule',
        label: 'Configuracion de periodo',
        done: requirementDone('schedule'),
        evidence: requirementMap.get('schedule')?.evidence || {},
      },
      {
        key: 'authentication',
        label: 'Configuracion de autenticacion',
        done: requirementDone('authentication'),
        evidence: requirementMap.get('authentication')?.evidence || {},
      },
      {
        key: 'voters',
        label: 'Carga y validacion de padron',
        done: requirementDone('voters'),
        evidence: requirementMap.get('voters')?.evidence || {},
      },
      {
        key: 'ballot',
        label: 'Configuracion de boleta',
        done: requirementDone('ballot_questions', 'ballot_options'),
        evidence: {
          questions: requirementMap.get('ballot_questions')?.evidence || {},
          options: requirementMap.get('ballot_options')?.evidence || {},
        },
      },
      {
        key: 'rules',
        label: 'Revision de reglas',
        done: requirementDone('results'),
        evidence: requirementMap.get('results')?.evidence || {},
      },
      {
        key: 'demo',
        label: 'Ensayo operativo',
        done: requirementDone('demo_clean', 'demo_review'),
        evidence: {
          clean: requirementMap.get('demo_clean')?.evidence || {},
          review: requirementMap.get('demo_review')?.evidence || {},
        },
      },
      {
        key: 'approval',
        label: 'Aprobacion final',
        done: approvalsComplete,
        evidence: { approvals: readiness.approvals || [] },
      },
      {
        key: 'publication',
        label: 'Publicacion',
        done: Boolean(readiness.ready && (election.status === StatusType.RUNNING || election.status === StatusType.COMPLETED)),
        evidence: { ready: readiness.ready, status: election.status },
      },
    ];
    const steps = stepDefinitions.map((step) => ({
      ...step,
      persisted: persistedCompleted.has(step.key),
      status: step.done ? 'complete' : persistedCompleted.has(step.key) ? 'blocked' : 'pending',
    }));
    const currentStep = this.normalizeWizardStep(progress.currentStep || '', true) || steps.find((step) => !step.done)?.key || 'publication';

    return {
      electionId: election.id,
      currentStep,
      updatedAt: progress.updatedAt || null,
      updatedBy: progress.updatedBy || null,
      completedSteps: steps.filter((step) => step.done).map((step) => step.key),
      persistedCompletedSteps: Array.from(persistedCompleted),
      steps,
      completionPct: steps.length ? Math.round((steps.filter((step) => step.done).length / steps.length) * 100) : 0,
    };
  }

  private normalizedSupervisionMembers(value: unknown) {
    const source = Array.isArray(value) ? value : [];
    const seen = new Set<string>();
    return source.reduce((members, raw) => {
      const entry = this.asRecord(raw);
      const role = this.normalizeSupervisionRole(entry.role);
      const email = String(entry.email || '').trim().toLowerCase();
      const userId = String(entry.userId || '').trim();
      const name = String(entry.name || '').trim();
      if (!email && !userId) return members;
      const key = `${role}:${userId || email}`;
      if (seen.has(key)) return members;
      seen.add(key);
      members.push({
        role,
        email,
        userId: userId || null,
        name: name || email || userId,
        addedAt: entry.addedAt || null,
        addedBy: entry.addedBy || null,
      });
      return members;
    }, [] as Array<{ role: SupervisionRole; email: string; userId: string | null; name: string; addedAt: string | null; addedBy: any }>);
  }

  private normalizeSupervisionRole(role: unknown): SupervisionRole {
    const normalized = String(role || '').trim().toLowerCase();
    if (normalized === 'commission' || normalized === 'comision') return 'commission';
    if (normalized === 'observer' || normalized === 'observador' || normalized === 'auditor') return 'observer';
    throw new BadRequestException('Rol de supervision invalido.');
  }

  private async buildReadiness(election: Election, user: User) {
    const ownerId = (election as any).user?.id || user.id;
    const [config, voterCount, questionRows, optionCount, realVotes, demoVotes] = await Promise.all([
      this.getConfigByElection(election.id),
      this.votersService.votersCountOfElection(election.id),
      this.questionReadinessRows(election.id, ownerId),
      this.countOptionsOfElection(election.id),
      this.countVotesOfElection(election.id, false),
      this.countVotesOfElection(election.id, true),
    ]);

    const startAt = config?.startAt || election.startDate;
    const endAt = config?.endAt || election.endDate;
    const hasValidPeriod = this.hasValidPeriod(startAt, endAt);
    const questionsCount = questionRows.length;
    const invalidQuestions = questionRows.filter((question) => {
      const options = Number(question.optionsCount || 0);
      const minSelect = Number(question.minSelect || 1);
      const maxSelect = Number(question.maxSelect || 1);
      const type = String(question.type || '').toLowerCase();
      if (!String(question.title || '').trim()) return true;
      if (maxSelect < minSelect) return true;
      return type !== 'text' && options <= 0;
    });
    const extra = this.asRecord(config.extra);
    const demoReview = this.asRecord(extra.demoReview);
    const approvalsRecord = this.asRecord(extra.approvals);
    const approvals = (['voters', 'ballot', 'schedule', 'publication'] as ApprovalSection[]).map((section) => {
      const approval = this.asRecord(approvalsRecord[section]);
      return {
        section,
        status: this.normalizeApprovalStatus(approval.status as ApprovalStatus | undefined, true),
        comment: approval.comment || null,
        reviewedAt: approval.reviewedAt || null,
        reviewedBy: approval.reviewedBy || null,
      };
    });

    const requirements = [
      {
        key: 'basic_info',
        label: 'Datos basicos de eleccion',
        done: Boolean(String(election.title || '').trim()),
        evidence: { title: election.title || null },
      },
      {
        key: 'schedule',
        label: 'Periodo electoral valido',
        done: hasValidPeriod,
        evidence: { startAt: startAt || null, endAt: endAt || null, timezone: config.timezone || null },
      },
      {
        key: 'voters',
        label: 'Padron cargado',
        done: voterCount > 0,
        evidence: { totalVoters: voterCount },
      },
      {
        key: 'ballot_questions',
        label: 'Preguntas configuradas',
        done: questionsCount > 0,
        evidence: { questionsCount },
      },
      {
        key: 'ballot_options',
        label: 'Opciones validas',
        done: optionCount > 0 && invalidQuestions.length === 0,
        evidence: { optionsCount: optionCount, invalidQuestionsCount: invalidQuestions.length },
      },
      {
        key: 'authentication',
        label: 'Autenticacion configurada',
        done: Boolean(config.requireAuthentication),
        evidence: { requireAuthentication: config.requireAuthentication, authMethod: extra.authMethod || 'PASSWORD' },
      },
      {
        key: 'results',
        label: 'Configuracion de resultados',
        done: Boolean(config.resultVisibility && config.tieBreaker),
        evidence: { resultVisibility: config.resultVisibility, tieBreaker: config.tieBreaker },
      },
      {
        key: 'demo_clean',
        label: 'Ensayo separado de produccion',
        done: demoVotes === 0,
        evidence: { demoVotes, realVotes, runMode: config.runMode },
      },
      {
        key: 'demo_review',
        label: 'Ensayo formal completado',
        done: demoReview.status === 'completed',
        evidence: {
          status: demoReview.status || null,
          completedAt: demoReview.completedAt || null,
          completedBy: demoReview.completedBy || null,
        },
      },
    ];

    const requiredApprovalsComplete = approvals.every((approval) => approval.status === 'approved');
    const completed = requirements.filter((item) => item.done).length;
    const completedApprovals = approvals.filter((approval) => approval.status === 'approved').length;
    const requirementsComplete = completed === requirements.length;
    const totalReadinessItems = requirements.length + approvals.length;
    const completedReadinessItems = completed + completedApprovals;

    return {
      electionId: election.id,
      generatedAt: new Date().toISOString(),
      ready: requirementsComplete && requiredApprovalsComplete,
      completionPct: totalReadinessItems
        ? Math.round((completedReadinessItems / totalReadinessItems) * 100)
        : 0,
      requirements,
      approvals,
      summary: {
        requirementsComplete,
        requiredApprovalsComplete,
        completedReadinessItems,
        totalReadinessItems,
        totalVoters: voterCount,
        questionsCount,
        optionsCount: optionCount,
        invalidQuestionsCount: invalidQuestions.length,
        realVotes,
        demoVotes,
        runMode: config.runMode,
      },
    };
  }

  private async ensureReadyForProduction(election: Election, user: User): Promise<void> {
    const readiness = await this.buildReadiness(election, user);
    if (readiness.ready) return;

    const pendingRequirements = readiness.requirements
      .filter((item) => !item.done)
      .map((item) => item.label);
    const pendingApprovals = readiness.approvals
      .filter((item) => item.status !== 'approved')
      .map((item) => item.section);
    const reasons = [...pendingRequirements, ...pendingApprovals.map((item) => `Aprobacion pendiente: ${item}`)];
    throw new BadRequestException(
      reasons.length
        ? `No se puede iniciar produccion. Pendiente: ${reasons.join(', ')}.`
        : 'No se puede iniciar produccion porque la eleccion no esta lista.',
    );
  }

  private async questionReadinessRows(electionId: string, userId: string) {
    return this.dataSource
      .createQueryBuilder()
      .select('question.id', 'id')
      .addSelect('question.title', 'title')
      .addSelect('question.type', 'type')
      .addSelect('question.minSelect', 'minSelect')
      .addSelect('question.maxSelect', 'maxSelect')
      .addSelect('COUNT(option.id)', 'optionsCount')
      .from('questions', 'question')
      .leftJoin('options', 'option', 'option."questionId" = question.id')
      .where('question."electionId" = :electionId', { electionId })
      .andWhere('question."userId" = :userId', { userId })
      .groupBy('question.id')
      .getRawMany();
  }

  private async countVotesOfElection(electionId: string, isDemo: boolean): Promise<number> {
    const raw = await this.voteRepository
      .createQueryBuilder('vote')
      .innerJoin('vote.option', 'option')
      .innerJoin('option.question', 'question')
      .select('COUNT(vote.id)', 'count')
      .where('question.electionId = :electionId', { electionId })
      .andWhere('vote.isDemo = :isDemo', { isDemo })
      .getRawOne();
    return Number(raw?.count ?? 0);
  }

  private hasValidPeriod(startAt: unknown, endAt: unknown): boolean {
    if (!startAt || !endAt) return false;
    const start = new Date(startAt as any).getTime();
    const end = new Date(endAt as any).getTime();
    return Number.isFinite(start) && Number.isFinite(end) && end > start;
  }

  private normalizeApprovalSection(section: string): ApprovalSection {
    const normalized = String(section || '').trim().toLowerCase();
    if (normalized === 'voters' || normalized === 'ballot' || normalized === 'schedule' || normalized === 'publication') {
      return normalized;
    }
    throw new BadRequestException('Seccion de aprobacion invalida.');
  }

  private normalizeApprovalStatus(status: ApprovalStatus | undefined, allowPending = false): ApprovalStatus {
    const normalized = String(status || '').trim().toLowerCase();
    if (normalized === 'approved' || normalized === 'rejected') return normalized;
    if (allowPending && normalized === 'pending') return 'pending';
    if (allowPending && !normalized) return 'pending';
    throw new BadRequestException('Estado de aprobacion invalido.');
  }

  private sanitizeConfigForAudit(config: ElectionConfig) {
    const { id, electionId, userId, startAt, endAt, timezone, votingMode, maxVotesPerVoter, allowMultipleSelections, requireAuthentication, anonymousVoting, logoUrl, theme, resultVisibility, tieBreaker, runMode, allowWriteIns, allowReceiptDownload, extra, createdAt, updatedAt } = config;
    return {
      id,
      electionId,
      userId,
      startAt,
      endAt,
      timezone,
      votingMode,
      maxVotesPerVoter,
      allowMultipleSelections,
      requireAuthentication,
      anonymousVoting,
      logoUrl,
      theme,
      resultVisibility,
      tieBreaker,
      runMode,
      allowWriteIns,
      allowReceiptDownload,
      extra,
      createdAt,
      updatedAt,
    };
  }

  private async getVoterRollEvidence(electionId: string) {
    const voters = await this.voterRepository
      .createQueryBuilder('voter')
      .select('voter.id', 'id')
      .addSelect('voter.email', 'email')
      .addSelect('voter.identifier', 'identifier')
      .addSelect('voter.name', 'name')
      .addSelect('voter.vote', 'vote')
      .addSelect('voter.createdAt', 'createdAt')
      .addSelect('voter.updatedAt', 'updatedAt')
      .innerJoin('voter.election', 'election')
      .where('election.id = :electionId', { electionId })
      .orderBy('voter.id', 'ASC')
      .getRawMany();
    const sanitized = voters.map((voter) => ({
      id: voter.id,
      email: voter.email || null,
      identifier: voter.identifier || null,
      name: voter.name || null,
      voted: voter.vote === true || voter.vote === 'true',
      createdAt: voter.createdAt || null,
      updatedAt: voter.updatedAt || null,
    }));
    return {
      totalVoters: sanitized.length,
      votersWhoVoted: sanitized.filter((voter) => voter.voted).length,
      hash: this.hashEvidence(sanitized),
    };
  }

  private async getReceiptEvidence(electionId: string) {
    const rows = await this.voteRepository
      .createQueryBuilder('vote')
      .innerJoin('vote.option', 'option')
      .leftJoin('option.question', 'question')
      .leftJoin('option.election', 'optionElection')
      .select('vote.receiptCode', 'receiptCode')
      .addSelect('vote.receiptHash', 'receiptHash')
      .addSelect('MIN(vote.votedAt)', 'issuedAt')
      .where('vote.isDemo = false')
      .andWhere('vote.receiptCode IS NOT NULL')
      .andWhere('(question.id IS NOT NULL AND question."electionId" = :electionId OR optionElection.id = :electionId)', { electionId })
      .groupBy('vote.receiptCode')
      .addGroupBy('vote.receiptHash')
      .orderBy('MIN(vote.votedAt)', 'ASC')
      .getRawMany();
    const receipts = rows.map((row) => ({
      code: row.receiptCode,
      hash: row.receiptHash,
      issuedAt: row.issuedAt,
    }));
    return {
      totalReceipts: receipts.length,
      receipts,
      hash: this.hashEvidence(receipts),
    };
  }

  private hashEvidence(value: unknown): string {
    return createHash('sha256').update(JSON.stringify(value ?? null)).digest('hex');
  }

  private csvEscape(value: unknown): string {
    const str = value === null || value === undefined ? '' : String(value);
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  }

  private buildSimplePdf(lines: string[]): Buffer {
    const pageWidth = 612;
    const pageHeight = 792;
    const margin = 54;
    const lineHeight = 14;
    const usableLines = Math.floor((pageHeight - margin * 2) / lineHeight);
    const wrappedLines = lines.flatMap((line) => this.wrapPdfLine(line, 88));
    const pages: string[][] = [];

    for (let index = 0; index < wrappedLines.length; index += usableLines) {
      pages.push(wrappedLines.slice(index, index + usableLines));
    }
    if (!pages.length) pages.push(['']);

    const objects: string[] = [];
    const addObject = (content: string) => {
      objects.push(content);
      return objects.length;
    };
    const catalogId = addObject('<< /Type /Catalog /Pages 2 0 R >>');
    const pagesId = addObject('');
    const fontId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
    const pageIds: number[] = [];

    pages.forEach((pageLines, pageIndex) => {
      const content = this.buildPdfPageContent(pageLines, margin, pageHeight - margin, lineHeight, pageIndex + 1, pages.length);
      const contentId = addObject(`<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`);
      const pageId = addObject(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`);
      pageIds.push(pageId);
    });

    objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;

    let pdf = '%PDF-1.4\n';
    const offsets: number[] = [0];
    objects.forEach((object, index) => {
      offsets.push(Buffer.byteLength(pdf, 'latin1'));
      pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    });
    const xrefOffset = Buffer.byteLength(pdf, 'latin1');
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    offsets.slice(1).forEach((offset) => {
      pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
    });
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    return Buffer.from(pdf, 'latin1');
  }

  private buildPdfPageContent(lines: string[], x: number, startY: number, lineHeight: number, page: number, totalPages: number): string {
    const commands = ['BT', '/F1 10 Tf', '12 TL'];
    lines.forEach((line, index) => {
      const y = startY - index * lineHeight;
      commands.push(`1 0 0 1 ${x} ${y} Tm (${this.escapePdfText(line)}) Tj`);
    });
    commands.push(`1 0 0 1 ${x} 30 Tm (${this.escapePdfText(`Pagina ${page} de ${totalPages}`)}) Tj`);
    commands.push('ET');
    return commands.join('\n');
  }

  private wrapPdfLine(line: string, maxLength: number): string[] {
    const clean = this.pdfSafeText(line);
    if (clean.length <= maxLength) return [clean];
    const result: string[] = [];
    let remaining = clean;
    while (remaining.length > maxLength) {
      const cut = remaining.lastIndexOf(' ', maxLength);
      const index = cut > 20 ? cut : maxLength;
      result.push(remaining.slice(0, index));
      remaining = remaining.slice(index).trimStart();
    }
    result.push(remaining);
    return result;
  }

  private escapePdfText(value: string): string {
    return this.pdfSafeText(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  }

  private pdfSafeText(value: string): string {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\x20-\x7E]/g, ' ');
  }

  private async safeLogElectionAction(
    electionId: string,
    action: TimelineAction,
    user: User,
    metadata: Record<string, any> = {},
  ) {
    try {
      await this.timeline.logAction({
        entityId: electionId,
        electionId,
        action,
        metadata: {
          ...metadata,
          userId: user.id,
          userName: user.fullName || user.email,
          userEmail: user.email,
        },
      });
    } catch (error) {
      this.logger.warn(`Could not log ${action}: ${error?.message || error}`);
    }
  }

  async getDashboardMetrics(user: User, scope: 'all' | 'mine' = 'mine') {
    const statusQuery = this.electionRepository
      .createQueryBuilder('election')
      .select('election.status', 'status')
      .addSelect('COUNT(*)', 'count');

    if (scope !== 'all') {
      statusQuery.where('election.userId = :userId', { userId: user.id });
    }

    const statusRows = await statusQuery
      .groupBy('election.status')
      .getRawMany();

    const statusMap = new Map(
      statusRows.map((row) => [
        row.status as StatusType,
        Number(row.count ?? 0),
      ]),
    );

    const elections = {
      total: 0,
      active: statusMap.get(StatusType.ACTIVE) ?? 0,
      running: statusMap.get(StatusType.RUNNING) ?? 0,
      completed: statusMap.get(StatusType.COMPLETED) ?? 0,
      incomplete: statusMap.get(StatusType.INCOMPLETE) ?? 0,
      inactive: statusMap.get(StatusType.INACTIVE) ?? 0,
      suspended: statusMap.get(StatusType.SUSPENDED) ?? 0,
    };
    elections.total =
      elections.active +
      elections.running +
      elections.completed +
      elections.incomplete +
      elections.inactive +
      elections.suspended;

    const voterQuery = this.voterRepository
      .createQueryBuilder('voter')
      .innerJoin('voter.election', 'election')
      .leftJoin('voter.votes', 'realVote', 'realVote.isDemo = false')
      .select('COUNT(DISTINCT voter.id)', 'totalVoters')
      .addSelect(
        'COUNT(DISTINCT CASE WHEN voter.vote = true OR realVote.id IS NOT NULL THEN voter.id END)',
        'votedVoters',
      );

    if (scope !== 'all') {
      voterQuery.where('election.userId = :userId', { userId: user.id });
    }

    const voterStats = await voterQuery.getRawOne();

    const userStats = await this.userRepository
      .createQueryBuilder('user')
      .select('COUNT(*)', 'total')
      .addSelect(
        'SUM(CASE WHEN user.isActive = true THEN 1 ELSE 0 END)',
        'active',
      )
      .addSelect(
        'SUM(CASE WHEN user.isVerified = true THEN 1 ELSE 0 END)',
        'verified',
      )
      .getRawOne();

    const totalUsers = Number(userStats?.total ?? 0);
    const activeUsers = Number(userStats?.active ?? 0);
    const verifiedUsers = Number(userStats?.verified ?? 0);

    const totalVoters = Number(voterStats?.totalVoters ?? 0);
    const votersWhoVoted = Number(voterStats?.votedVoters ?? 0);
    const participationPct =
      totalVoters > 0
        ? Number(((votersWhoVoted / totalVoters) * 100).toFixed(1))
        : 0;
    const absencePct =
      totalVoters > 0 ? Number((100 - participationPct).toFixed(1)) : 0;

    return {
      users: {
        total: totalUsers,
        active: activeUsers,
        inactive: Math.max(0, totalUsers - activeUsers),
        verified: verifiedUsers,
        unverified: Math.max(0, totalUsers - verifiedUsers),
      },
      elections,
      attendance: {
        totalVoters,
        votersWhoVoted,
        participationPct,
        absencePct,
      },
    };
  }

  private handleDBExceptions(error: { code?: string; detail?: string }) {
    this.logger.error(error);
    if (error.code === '23505' || error.code == '20505') {
      throw new BadRequestException('Ya existe un registro con esos datos.');
    }
    throw new InternalServerErrorException('Ocurrió un error inesperado.');
  }
}
