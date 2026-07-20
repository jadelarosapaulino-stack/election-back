import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { CatalogItem } from './entities/catalog-item.entity';
import { CreateCatalogItemDto, UpdateCatalogItemDto } from './dto/dto';
import { ELECTION_THEME_CATALOG_SEED } from './seeds/election-theme.seed';

type CatalogSeed = Pick<
  CatalogItem,
  'groupKey' | 'code' | 'label' | 'description' | 'sortOrder' | 'active' | 'metadata'
>;

const buildElectionThemeCatalogSeeds = (): CatalogSeed[] =>
  ELECTION_THEME_CATALOG_SEED.map((theme) => ({
    groupKey: 'ELECTION_THEME',
    code: theme.code,
    label: theme.label,
    description: theme.description,
    sortOrder: theme.sortOrder,
    active: theme.active,
    metadata: { config: theme.config },
  }));

@Injectable()
export class CatalogsService implements OnModuleInit {
  private defaultsReady = false;
  private readonly timezoneGroupKey = 'ELECTION_TIMEZONE';
  private readonly defaultCatalogs: Record<string, CatalogSeed[]> = {
    ELECTION_VOTING_MODE: [
      {
        groupKey: 'ELECTION_VOTING_MODE',
        code: 'FPTP',
        label: 'Mayoria simple',
        description: 'El candidato con mas votos gana (First Past The Post).',
        sortOrder: 10,
        active: true,
      },
      {
        groupKey: 'ELECTION_VOTING_MODE',
        code: 'RANKED',
        label: 'Voto preferencial',
        description: 'Los votantes clasifican candidatos por orden de preferencia.',
        sortOrder: 20,
        active: true,
      },
      {
        groupKey: 'ELECTION_VOTING_MODE',
        code: 'APPROVAL',
        label: 'Voto por aprobacion',
        description: 'Se puede aprobar cualquier cantidad de candidatos.',
        sortOrder: 30,
        active: true,
      },
      {
        groupKey: 'ELECTION_VOTING_MODE',
        code: 'STV',
        label: 'Voto transferible',
        description: 'Voto Transferible Unico para elecciones de varios ganadores.',
        sortOrder: 40,
        active: true,
      },
    ],
    ELECTION_RESULT_VISIBILITY: [
      {
        groupKey: 'ELECTION_RESULT_VISIBILITY',
        code: 'AFTER_END',
        label: 'Despues de terminar',
        description: 'Los resultados se publican al cierre.',
        sortOrder: 10,
        active: true,
      },
      {
        groupKey: 'ELECTION_RESULT_VISIBILITY',
        code: 'DURING',
        label: 'Durante la eleccion',
        description: 'Los resultados se muestran durante el proceso.',
        sortOrder: 20,
        active: true,
      },
      {
        groupKey: 'ELECTION_RESULT_VISIBILITY',
        code: 'NEVER',
        label: 'Nunca',
        description: 'No se publican resultados.',
        sortOrder: 30,
        active: true,
      },
    ],
    ELECTION_TIE_BREAKER: [
      {
        groupKey: 'ELECTION_TIE_BREAKER',
        code: 'RANDOM',
        label: 'Aleatorio',
        description: 'Resuelve empate por seleccion aleatoria.',
        sortOrder: 10,
        active: true,
        metadata: {
          rules: [
            'Aplica cuando dos o mas opciones tienen igual cantidad de votos.',
            'Selecciona una opcion empatada de forma aleatoria deterministica.',
            'No requiere intervencion manual para definir ganador.',
          ],
        },
      },
      {
        groupKey: 'ELECTION_TIE_BREAKER',
        code: 'RUNOFF',
        label: 'Segunda vuelta',
        description: 'Resuelve empate con ronda adicional.',
        sortOrder: 20,
        active: true,
        metadata: {
          rules: [
            'Aplica cuando existe empate en el primer lugar.',
            'No define ganador en la ronda actual.',
            'Requiere crear una segunda vuelta con los empatados.',
          ],
        },
      },
      {
        groupKey: 'ELECTION_TIE_BREAKER',
        code: 'BY_LEAST_ERRORS',
        label: 'Menor error',
        description: 'Prioriza la opcion con menor error acumulado.',
        sortOrder: 30,
        active: true,
        metadata: {
          rules: [
            'Aplica cuando existe empate en votos.',
            'Prioriza la opcion con menor orden en boleta como proxy de menor error.',
            'Si persiste el empate, se aplica seleccion por orden lexicografico.',
          ],
        },
      },
    ],
    ELECTION_AUTH_METHOD: [
      {
        groupKey: 'ELECTION_AUTH_METHOD',
        code: 'PASSWORD',
        label: 'Usuario y contrasena',
        description: 'Ingreso por credenciales de votante.',
        sortOrder: 10,
        active: true,
      },
      {
        groupKey: 'ELECTION_AUTH_METHOD',
        code: 'EMAIL_TOKEN',
        label: 'Token temporal por correo',
        description: 'Ingreso mediante token enviado por correo.',
        sortOrder: 20,
        active: true,
      },
    ],
    ELECTION_THEME: buildElectionThemeCatalogSeeds(),
    ELECTION_STATUS: [
      { groupKey: 'ELECTION_STATUS', code: 'active', label: 'Activa', sortOrder: 10, active: true },
      {
        groupKey: 'ELECTION_STATUS',
        code: 'running',
        label: 'En curso',
        sortOrder: 20,
        active: true,
      },
      {
        groupKey: 'ELECTION_STATUS',
        code: 'completed',
        label: 'Completada',
        sortOrder: 30,
        active: true,
      },
      {
        groupKey: 'ELECTION_STATUS',
        code: 'incomplete',
        label: 'Incompleta',
        sortOrder: 35,
        active: true,
      },
      {
        groupKey: 'ELECTION_STATUS',
        code: 'inactive',
        label: 'Inactiva',
        sortOrder: 40,
        active: true,
      },
      {
        groupKey: 'ELECTION_STATUS',
        code: 'suspended',
        label: 'Suspendida',
        sortOrder: 50,
        active: true,
      },
      {
        groupKey: 'ELECTION_STATUS',
        code: 'canceled',
        label: 'Cancelada',
        sortOrder: 60,
        active: true,
      },
    ],
    ELECTION_VOTING_SCREEN_VIEW: [
      {
        groupKey: 'ELECTION_VOTING_SCREEN_VIEW',
        code: 'guided',
        label: 'Guiada',
        description: 'Una experiencia paso a paso para votantes con menor carga visual.',
        sortOrder: 10,
        active: true,
        metadata: { icon: 'linear_scale' },
      },
      {
        groupKey: 'ELECTION_VOTING_SCREEN_VIEW',
        code: 'cards',
        label: 'Tarjetas',
        description: 'Opciones destacadas en tarjetas amplias con foto o iniciales.',
        sortOrder: 20,
        active: true,
        metadata: { icon: 'dashboard' },
      },
      {
        groupKey: 'ELECTION_VOTING_SCREEN_VIEW',
        code: 'list',
        label: 'Lista compacta',
        description: 'Vista densa para boletas largas o procesos con muchas opciones.',
        sortOrder: 30,
        active: true,
        metadata: { icon: 'view_list' },
      },
      {
        groupKey: 'ELECTION_VOTING_SCREEN_VIEW',
        code: 'grid',
        label: 'Grilla',
        description: 'Distribuye opciones en columnas para pantallas de escritorio.',
        sortOrder: 40,
        active: true,
        metadata: { icon: 'grid_view' },
      },
    ],
    ELECTION_VOTING_SCREEN_DENSITY: [
      {
        groupKey: 'ELECTION_VOTING_SCREEN_DENSITY',
        code: 'comfortable',
        label: 'Cómoda',
        description: 'Espaciado generoso entre elementos para fácil lectura.',
        sortOrder: 10,
        active: true,
      },
      {
        groupKey: 'ELECTION_VOTING_SCREEN_DENSITY',
        code: 'compact',
        label: 'Compacta',
        description: 'Espaciado reducido para aprovechar más espacio en pantalla.',
        sortOrder: 20,
        active: true,
      },
    ],
  };

  constructor(
    @InjectRepository(CatalogItem)
    private readonly catalogRepo: Repository<CatalogItem>
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureDefaults();
  }

  async findGroups(): Promise<Array<{ groupKey: string; total: number; active: number }>> {
    if (!this.defaultsReady) {
      await this.ensureDefaults();
    }
    const rows = await this.catalogRepo
      .createQueryBuilder('item')
      .select('item.groupKey', 'groupKey')
      .addSelect('COUNT(*)', 'total')
      .addSelect('SUM(CASE WHEN item.active = true THEN 1 ELSE 0 END)', 'active')
      .groupBy('item.groupKey')
      .orderBy('item.groupKey', 'ASC')
      .getRawMany();

    return rows.map((row) => ({
      groupKey: row.groupKey,
      total: Number(row.total || 0),
      active: Number(row.active || 0),
    }));
  }

  async findAll(groupKey?: string, active?: boolean): Promise<CatalogItem[]> {
    const normalizedGroup = this.normalizeGroupKey(groupKey);
    if (!this.defaultsReady) {
      await this.ensureDefaults();
    }

    const where: FindOptionsWhere<CatalogItem> = {};
    if (normalizedGroup) where.groupKey = normalizedGroup;
    if (typeof active === 'boolean') where.active = active;

    return this.catalogRepo.find({
      where,
      order: { groupKey: 'ASC', sortOrder: 'ASC', label: 'ASC' },
    });
  }

  async findAllPaginated(
    groupKey?: string,
    active?: boolean,
    page = 1,
    pageSize = 10
  ): Promise<{
    items: CatalogItem[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const normalizedGroup = this.normalizeGroupKey(groupKey);
    if (!this.defaultsReady) {
      await this.ensureDefaults();
    }

    const safePage = Number.isFinite(page) ? Math.max(1, Math.trunc(page)) : 1;
    const safePageSize = Number.isFinite(pageSize)
      ? Math.min(100, Math.max(1, Math.trunc(pageSize)))
      : 10;

    const where: FindOptionsWhere<CatalogItem> = {};
    if (normalizedGroup) where.groupKey = normalizedGroup;
    if (typeof active === 'boolean') where.active = active;

    const [items, total] = await this.catalogRepo.findAndCount({
      where,
      order: { groupKey: 'ASC', sortOrder: 'ASC', label: 'ASC' },
      skip: (safePage - 1) * safePageSize,
      take: safePageSize,
    });

    return {
      items,
      total,
      page: safePage,
      pageSize: safePageSize,
      totalPages: total > 0 ? Math.ceil(total / safePageSize) : 0,
    };
  }

  async findTieBreakers(active?: boolean): Promise<CatalogItem[]> {
    return this.findAll('ELECTION_TIE_BREAKER', active);
  }

  async findVotingModes(active?: boolean): Promise<CatalogItem[]> {
    return this.findAll('ELECTION_VOTING_MODE', active);
  }

  async registerVotingModeDefaults(): Promise<CatalogItem[]> {
    await this.ensureDefaultsForGroup('ELECTION_VOTING_MODE');
    return this.findVotingModes();
  }

  async registerTieBreakerDefaults(): Promise<CatalogItem[]> {
    await this.ensureDefaultsForGroup('ELECTION_TIE_BREAKER');
    return this.findTieBreakers();
  }

  async createVotingMode(dto: Omit<CreateCatalogItemDto, 'groupKey'>): Promise<CatalogItem> {
    return this.create({
      ...dto,
      groupKey: 'ELECTION_VOTING_MODE',
    });
  }

  async updateVotingMode(id: string, dto: Omit<UpdateCatalogItemDto, 'groupKey'>): Promise<CatalogItem> {
    return this.update(id, dto);
  }

  async createTieBreaker(dto: Omit<CreateCatalogItemDto, 'groupKey'>): Promise<CatalogItem> {
    return this.create({
      ...dto,
      groupKey: 'ELECTION_TIE_BREAKER',
    });
  }

  async updateTieBreaker(id: string, dto: Omit<UpdateCatalogItemDto, 'groupKey'>): Promise<CatalogItem> {
    return this.update(id, dto);
  }

  async create(dto: CreateCatalogItemDto): Promise<CatalogItem> {
    const groupKey = this.normalizeGroupKey(dto.groupKey);
    const code = this.normalizeCode(dto.code);
    const label = dto.label?.trim();

    if (!groupKey || !code || !label) {
      throw new BadRequestException('groupKey, code y label son obligatorios.');
    }

    await this.ensureUniqueCode(groupKey, code);
    const item = this.catalogRepo.create({
      groupKey,
      code,
      label,
      description: dto.description?.trim() || null,
      sortOrder: dto.sortOrder ?? 0,
      active: dto.active ?? true,
      metadata: dto.metadata || null,
    });
    return this.catalogRepo.save(item);
  }

  async update(id: string, dto: UpdateCatalogItemDto): Promise<CatalogItem> {
    const item = await this.catalogRepo.findOne({ where: { id } });
    if (!item) {
      throw new NotFoundException('Catalogo no encontrado.');
    }

    const nextGroupKey = dto.groupKey ? this.normalizeGroupKey(dto.groupKey) : item.groupKey;
    const nextCode = dto.code ? this.normalizeCode(dto.code) : item.code;
    if (nextGroupKey !== item.groupKey || nextCode !== item.code) {
      await this.ensureUniqueCode(nextGroupKey, nextCode, id);
    }

    item.groupKey = nextGroupKey;
    item.code = nextCode;
    if (dto.label !== undefined) item.label = dto.label.trim();
    if (dto.description !== undefined) item.description = dto.description?.trim() || null;
    if (dto.sortOrder !== undefined) item.sortOrder = dto.sortOrder;
    if (dto.active !== undefined) item.active = dto.active;
    if (dto.metadata !== undefined) item.metadata = dto.metadata || null;

    return this.catalogRepo.save(item);
  }

  async remove(id: string): Promise<{ id: string; removed: boolean }> {
    const item = await this.catalogRepo.findOne({ where: { id } });
    if (!item) {
      throw new NotFoundException('Catalogo no encontrado.');
    }
    await this.catalogRepo.softRemove(item);
    return { id, removed: true };
  }

  private async ensureDefaults(): Promise<void> {
    if (this.defaultsReady) return;
    const groups = Object.keys(this.defaultCatalogs);
    for (const groupKey of groups) {
      await this.ensureDefaultsForGroup(groupKey);
    }
    await this.ensureTimezoneDefaults();
    this.defaultsReady = true;
  }

  private async ensureTimezoneDefaults(): Promise<void> {
    const seeds = this.buildTimezoneCatalogSeeds();
    if (!seeds.length) return;

    const existingItems = await this.catalogRepo.find({
      where: { groupKey: this.timezoneGroupKey },
    });
    const existingByCode = new Map(existingItems.map((item) => [item.code, item]));
    const toInsert: CatalogItem[] = [];
    const toUpdate: CatalogItem[] = [];

    for (const seed of seeds) {
      const current = existingByCode.get(seed.code);
      if (!current) {
        toInsert.push(this.catalogRepo.create(seed));
        continue;
      }

      let shouldUpdate = false;
      if (!current.description && seed.description) {
        current.description = seed.description;
        shouldUpdate = true;
      }
      if (
        (!current.metadata || Object.keys(current.metadata).length === 0) &&
        seed.metadata
      ) {
        current.metadata = seed.metadata;
        shouldUpdate = true;
      }
      if (shouldUpdate) {
        toUpdate.push(current);
      }
    }

    if (toInsert.length) {
      await this.catalogRepo.save(toInsert, { chunk: 200 });
    }
    if (toUpdate.length) {
      await this.catalogRepo.save(toUpdate, { chunk: 200 });
    }
  }

  private buildTimezoneCatalogSeeds(): CatalogSeed[] {
    const timezones = this.getSupportedTimezones();
    return timezones.map((timeZone, index) => ({
      groupKey: this.timezoneGroupKey,
      code: timeZone,
      label: timeZone,
      description: 'Zona horaria IANA',
      sortOrder: (index + 1) * 10,
      active: true,
      metadata: {
        name: timeZone,
        utc_offset: this.readTimezoneOffset(timeZone),
        timezone_abbr: this.readTimezoneAbbreviation(timeZone),
      },
    }));
  }

  private getSupportedTimezones(): string[] {
    const intlWithSupportedValues = Intl as unknown as {
      supportedValuesOf?: (key: string) => string[];
    };

    if (typeof intlWithSupportedValues.supportedValuesOf === 'function') {
      try {
        const values = intlWithSupportedValues.supportedValuesOf('timeZone');
        if (Array.isArray(values) && values.length > 0) {
          const normalized = new Set(values);
          normalized.add('UTC');
          return Array.from(normalized).sort((a, b) => a.localeCompare(b));
        }
      } catch {
        // Ignore and use fallback values.
      }
    }

    return [
      'UTC',
      'America/Bogota',
      'America/Caracas',
      'America/Lima',
      'America/Mexico_City',
      'America/New_York',
      'America/Panama',
      'America/Santiago',
      'America/Sao_Paulo',
      'America/Toronto',
      'Europe/London',
      'Europe/Madrid',
    ];
  }

  private readTimezoneOffset(timeZone: string): string {
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        timeZoneName: 'shortOffset',
      });
      const part = formatter.formatToParts(new Date()).find((item) => item.type === 'timeZoneName');
      return part?.value?.replace('GMT', 'UTC') || '';
    } catch {
      return '';
    }
  }

  private readTimezoneAbbreviation(timeZone: string): string {
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        timeZoneName: 'short',
      });
      const part = formatter.formatToParts(new Date()).find((item) => item.type === 'timeZoneName');
      return part?.value?.replace('GMT', 'UTC') || '';
    } catch {
      return '';
    }
  }

  private async ensureDefaultsForGroup(groupKey: string): Promise<void> {
    const seeds = this.defaultCatalogs[groupKey];
    if (!seeds?.length) return;

    for (const seed of seeds) {
      // Incluir registros soft-deleados para evitar violar el unique index
      // al reinsertar un ítem que fue eliminado con softRemove.
      const existing = await this.catalogRepo.findOne({
        withDeleted: true,
        where: { groupKey: seed.groupKey, code: seed.code },
      });

      if (existing) {
        // Restaurar si fue soft-deleado
        if (existing.deletedAt) {
          await this.catalogRepo.restore(existing.id);
        }

        let shouldSave = false;
        if (!existing.description && seed.description) {
          existing.description = seed.description;
          shouldSave = true;
        }
        if (
          (!existing.metadata || Object.keys(existing.metadata).length === 0) &&
          seed.metadata
        ) {
          existing.metadata = seed.metadata;
          shouldSave = true;
        }
        if (shouldSave) {
          await this.catalogRepo.save(existing);
        }
        continue;
      }
      const item = this.catalogRepo.create(seed);
      await this.catalogRepo.save(item);
    }
  }

  private async ensureUniqueCode(groupKey: string, code: string, excludeId?: string): Promise<void> {
    const existing = await this.catalogRepo.findOne({
      where: { groupKey, code },
    });
    if (existing && existing.id !== excludeId) {
      throw new BadRequestException('Ya existe un item con ese codigo en el grupo.');
    }
  }

  private normalizeGroupKey(value?: string): string {
    return (value || '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '_');
  }

  private normalizeCode(value?: string): string {
    return (value || '').trim();
  }
}
