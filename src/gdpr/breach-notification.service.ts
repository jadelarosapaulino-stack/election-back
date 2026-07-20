import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import { BreachEvent, BreachSeverity } from './breach-event.entity';
import { CreateBreachEventDto } from './dto/create-breach-event.dto';
import {
  EmailService,
  GdprBreachEmailData,
} from '../common/email/email.service';

@Injectable()
export class BreachNotificationService {
  private readonly logger = new Logger(BreachNotificationService.name);
  private readonly dpoEmail: string;
  private readonly authorityEmail: string;
  private readonly authorityName: string;

  constructor(
    @InjectRepository(BreachEvent)
    private readonly breachEventRepo: Repository<BreachEvent>,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {
    this.dpoEmail =
      this.configService.get<string>('DPO_EMAIL') || 'dpo@votingsuite.com';
    this.authorityEmail =
      this.configService.get<string>('SUPERVISORY_AUTHORITY_EMAIL') ||
      'introductions@aepd.es';
    this.authorityName =
      this.configService.get<string>('SUPERVISORY_AUTHORITY_NAME') || 'AEPD';
  }

  // ── Crear brecha y notificar según severidad ──────────────────────────

  async create(dto: CreateBreachEventDto): Promise<BreachEvent> {
    const event = this.breachEventRepo.create(dto);
    const saved = await this.breachEventRepo.save(event);

    this.logger.warn(
      `SECURITY BREACH [${saved.severity.toUpperCase()}]: ${saved.type} — ${
        saved.id
      } ` +
        `(affected: ${
          saved.affectedUsers
        }, detected: ${saved.detectedAt.toISOString()})`,
    );

    // Notificación escalonada según severidad
    if (
      saved.severity === ('critical' as BreachSeverity) ||
      saved.severity === ('high' as BreachSeverity)
    ) {
      await this.notifyDpo(saved);
      if (saved.requiresAuthorityNotification) {
        await this.scheduleAuthorityNotification(saved);
      }
      if (saved.requiresSubjectNotification) {
        await this.notifySubjects(saved.id);
      }
    } else if (saved.severity === ('medium' as BreachSeverity)) {
      await this.notifyDpo(saved);
    }
    // low: solo registro, no notificación

    return saved;
  }

  // ── Notificar al DPO ──────────────────────────────────────────────────

  async notifyDpo(event: BreachEvent): Promise<void> {
    try {
      await this.emailService.sendGdprDpoNotification(
        this.dpoEmail,
        this.toEmailData(event, {
          authorityNotification: event.requiresAuthorityNotification
            ? 'Sí (Art. 33)'
            : 'No',
          subjectNotification: event.requiresSubjectNotification
            ? 'Sí (Art. 34)'
            : 'No',
        }),
      );
      this.logger.log(`DPO notified for breach ${event.id}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to notify DPO for breach ${event.id}: ${message}`,
      );
    }
  }

  // ── Notificar a autoridad supervisora (Art. 33) ───────────────────────

  async scheduleAuthorityNotification(event: BreachEvent): Promise<void> {
    // In a real implementation this would schedule via @nestjs/schedule or a queue.
    // For now we notify immediately if the event requires it.
    this.logger.warn(
      `Art.33 authority notification required for breach ${event.id} — ` +
        `detected at ${event.detectedAt.toISOString()}. ` +
        `Deadline: 72h from detection.`,
    );
  }

  async notifyAuthority(eventId: string): Promise<BreachEvent> {
    const event = await this.breachEventRepo.findOneBy({ id: eventId });
    if (!event) {
      throw new NotFoundException(`Breach event ${eventId} not found`);
    }

    try {
      await this.emailService.sendGdprAuthorityNotification(
        this.authorityEmail,
        this.toEmailData(event, {
          authorityName: this.authorityName,
          notifiedAt: new Date().toISOString(),
        }),
      );

      event.authorityNotifiedAt = new Date();
      event.status = 'notified_authority';
      await this.breachEventRepo.save(event);

      this.logger.log(`Supervisory authority notified for breach ${event.id}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to notify authority for breach ${event.id}: ${message}`,
      );
      throw error;
    }

    return event;
  }

  // ── Notificar a affected data subjects (Art. 34) ─────────────────────

  async notifySubjects(eventId: string): Promise<BreachEvent> {
    const event = await this.breachEventRepo.findOneBy({ id: eventId });
    if (!event) {
      throw new NotFoundException(`Breach event ${eventId} not found`);
    }

    if (!event.affectedUserEmails?.length) {
      this.logger.warn(
        `Art.34: breach ${event.id} has no affectedUserEmails — ` +
          `skipping email send. Use POST /gdpr/breaches/:id/set-affected-emails first.`,
      );
      event.subjectsNotifiedAt = new Date();
      event.status = 'notified_subjects';
      await this.breachEventRepo.save(event);
      return event;
    }

    const results = await Promise.allSettled(
      event.affectedUserEmails.map((email) =>
        this.emailService.sendGdprSubjectNotification(
          email,
          this.toEmailData(event),
        ),
      ),
    );

    const failures = results.filter((r) => r.status === 'rejected');
    if (failures.length > 0) {
      this.logger.error(
        `Art.34: ${failures.length}/${event.affectedUserEmails.length} ` +
          `emails failed for breach ${event.id}`,
      );
    } else {
      this.logger.log(
        `Art.34: all ${event.affectedUserEmails.length} subjects notified for breach ${event.id}`,
      );
    }

    event.subjectsNotifiedAt = new Date();
    event.status = 'notified_subjects';
    await this.breachEventRepo.save(event);

    return event;
  }

  // ── Set affected user emails ─────────────────────────────────────────

  async setAffectedEmails(
    eventId: string,
    emails: string[],
  ): Promise<BreachEvent> {
    const event = await this.breachEventRepo.findOneBy({ id: eventId });
    if (!event) {
      throw new NotFoundException(`Breach event ${eventId} not found`);
    }

    event.affectedUserEmails = emails;
    event.affectedUsers = emails.length;
    await this.breachEventRepo.save(event);

    return event;
  }

  // ── Verificar brechas pendientes de notificación a autoridad (72h) ───

  async checkPendingAuthorityNotifications(): Promise<BreachEvent[]> {
    const deadline = new Date();
    deadline.setHours(deadline.getHours() - 72);

    return this.breachEventRepo.find({
      where: {
        requiresAuthorityNotification: true,
        authorityNotifiedAt: null as unknown as Date,
        detectedAt: LessThanOrEqual(deadline),
      },
    });
  }

  /**
   * Devuelve todas las brechas que requieren notificación a la autoridad
   * supervisora y que aún no han sido notificadas, sin filtro temporal.
   * El scheduler usa esto para calcular tiempo restante y emitir alertas.
   */
  async findBreachesPendingAuthorityNotification(): Promise<BreachEvent[]> {
    return this.breachEventRepo.find({
      where: {
        requiresAuthorityNotification: true,
        authorityNotifiedAt: null as unknown as Date,
      },
      order: { detectedAt: 'ASC' },
    });
  }

  // ── Cerrar brecha ─────────────────────────────────────────────────────

  async resolve(eventId: string, notes: string): Promise<BreachEvent> {
    const event = await this.breachEventRepo.findOneBy({ id: eventId });
    if (!event) {
      throw new NotFoundException(`Breach event ${eventId} not found`);
    }

    event.status = 'resolved';
    event.resolutionNotes = notes;
    event.resolvedAt = new Date();
    await this.breachEventRepo.save(event);

    return event;
  }

  // ── CRUD ──────────────────────────────────────────────────────────────

  async findAll(params: {
    severity?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: BreachEvent[]; total: number }> {
    const { severity, status, page = 1, limit = 20 } = params;
    const qb = this.breachEventRepo.createQueryBuilder('breach');

    if (severity) {
      qb.andWhere('breach.severity = :severity', { severity });
    }
    if (status) {
      qb.andWhere('breach.status = :status', { status });
    }

    qb.orderBy('breach.detectedAt', 'DESC');
    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }

  async findOne(id: string): Promise<BreachEvent | null> {
    return this.breachEventRepo.findOneBy({ id });
  }

  private toEmailData(
    event: BreachEvent,
    extra: Partial<GdprBreachEmailData> = {},
  ): GdprBreachEmailData {
    return {
      breachId: event.id,
      type: event.type,
      severity: event.severity.toUpperCase(),
      affectedUsers: event.affectedUsers,
      dataCategories: event.dataCategories.join(', ') || 'No especificadas',
      detectedAt: event.detectedAt.toISOString(),
      description: event.description,
      dpoEmail: this.dpoEmail,
      ...extra,
    };
  }
}
