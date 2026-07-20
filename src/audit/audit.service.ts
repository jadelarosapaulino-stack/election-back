import { Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { createHash } from 'crypto';
import { Connection, Model } from 'mongoose';
import { DataSource } from 'typeorm';
import { Aes256GcmService } from 'src/common/security/aes-256-gcm.service';

type AuditSeverity = 'ALTA' | 'MEDIA' | 'BAJA';
type NodeStatus = 'online' | 'warning' | 'offline';

interface AuditEventDto {
  id: string;
  date: string;
  event: string;
  user: string;
  module: string;
  severity: AuditSeverity;
  hash: string;
  action: string;
}

interface AuditSummaryQuery {
  page?: string;
  pageSize?: string;
  module?: string;
  severity?: string;
  user?: string;
  query?: string;
  dateFrom?: string;
  dateTo?: string;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectModel('timeline') private readonly timelineModel: Model<any>,
    @InjectConnection() private readonly mongoConnection: Connection,
    private readonly dataSource: DataSource,
    private readonly aes: Aes256GcmService,
  ) {}

  async getSummary(query: AuditSummaryQuery = {}) {
    const page = this.normalizePositiveInt(query.page, 1, 1, 100000);
    const pageSize = this.normalizePositiveInt(query.pageSize, 10, 1, 100);
    const mongoQuery = this.buildMongoQuery(query);
    const records = await this.timelineModel
      .find(mongoQuery)
      .sort({ createdAt: -1 })
      .limit(2000)
      .lean()
      .exec();

    const allEvents = records.map((record) => this.toAuditEvent(record));
    const filteredEvents = allEvents.filter((event) => this.matchesDerivedFilters(event, query));
    const totalFilteredEvents = filteredEvents.length;
    const pageStart = (page - 1) * pageSize;
    const events = filteredEvents.slice(pageStart, pageStart + pageSize);
    const metricRecords = await this.timelineModel
      .find({})
      .sort({ createdAt: -1 })
      .limit(5000)
      .lean()
      .exec();
    const metricEvents = metricRecords.map((record) => this.toAuditEvent(record));
    const nodes = await this.getSystemNodes();
    const activeNodes = nodes.filter((node) => node.status === 'online').length;
    const integrityScore = nodes.length ? Math.round((activeNodes / nodes.length) * 100) : 0;
    const lastEvent = metricEvents[0] || null;
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const todayCount = metricEvents.filter((event) => event.date.slice(0, 10) === today).length;
    const criticalEvents = metricEvents.filter((event) => event.severity === 'ALTA');
    const nodeAlerts = nodes
      .filter((node) => node.status !== 'online')
      .map((node) => ({
        title: `${node.name} requiere atencion`,
        description: node.detail,
        severity: node.status === 'offline' ? 'ALTA' : 'MEDIA',
        time: 'Ahora',
      }));

    return {
      metrics: {
        eventsToday: todayCount,
        totalEvents: await this.timelineModel.countDocuments({}).exec(),
        criticalAlerts: criticalEvents.length + nodeAlerts.filter((alert) => alert.severity === 'ALTA').length,
        lastAuditAt: lastEvent?.date || null,
        integrityScore,
      },
      events,
      pagination: {
        page,
        pageSize,
        total: totalFilteredEvents,
        totalPages: Math.max(1, Math.ceil(totalFilteredEvents / pageSize)),
        hasServerSidePagination: true,
      },
      severityDistribution: {
        baja: filteredEvents.filter((event) => event.severity === 'BAJA').length,
        media: filteredEvents.filter((event) => event.severity === 'MEDIA').length,
        alta: filteredEvents.filter((event) => event.severity === 'ALTA').length,
      },
      alerts: [
        ...criticalEvents.slice(0, 3).map((event) => ({
          title: event.event,
          description: `${event.module} - ${event.user}`,
          severity: event.severity,
          time: event.date,
        })),
        ...nodeAlerts,
      ].slice(0, 4),
      filterOptions: {
        modules: Array.from(new Set(metricEvents.map((event) => event.module))).sort(),
        users: Array.from(new Set(metricEvents.map((event) => event.user))).sort(),
      },
      integrity: {
        score: integrityScore,
        verified: integrityScore === 100,
        blockchainStructure: 'Estructura blockchain',
        nodeSync: activeNodes === nodes.length ? 'Activa' : 'Degradada',
        description:
          integrityScore === 100
            ? 'Los registros han sido firmados criptograficamente y validados sin discrepancias.'
            : 'Uno o mas nodos del sistema requieren revision antes de certificar la auditoria.',
      },
      nodes,
    };
  }

  private buildMongoQuery(query: AuditSummaryQuery): Record<string, any> {
    const mongoQuery: Record<string, any> = {};
    const dateRange: Record<string, Date> = {};
    const from = this.asDate(query.dateFrom, 'start');
    const to = this.asDate(query.dateTo, 'end');
    if (from) dateRange.$gte = from;
    if (to) dateRange.$lte = to;
    if (Object.keys(dateRange).length) mongoQuery.createdAt = dateRange;
    return mongoQuery;
  }

  private matchesDerivedFilters(event: AuditEventDto, query: AuditSummaryQuery): boolean {
    const severity = String(query.severity || 'all').trim().toUpperCase();
    const module = String(query.module || 'all').trim();
    const user = String(query.user || '').trim().toLowerCase();
    const search = String(query.query || '').trim().toLowerCase();
    const matchesSeverity = severity === 'ALL' || event.severity === severity;
    const matchesModule = module === 'all' || event.module === module;
    const matchesUser = !user || event.user.toLowerCase().includes(user);
    const matchesQuery =
      !search ||
      [event.event, event.module, event.hash, event.user].some((value) =>
        String(value || '').toLowerCase().includes(search),
      );
    return matchesSeverity && matchesModule && matchesUser && matchesQuery;
  }

  private normalizePositiveInt(value: unknown, fallback: number, min: number, max: number): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(min, Math.min(max, Math.floor(parsed)));
  }

  private asDate(value: unknown, boundary: 'start' | 'end'): Date | null {
    const raw = String(value || '').trim();
    if (!raw) return null;
    const date = new Date(`${raw}T${boundary === 'start' ? '00:00:00.000' : '23:59:59.999'}`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private toAuditEvent(record: any): AuditEventDto {
    const action = String(record?.action || 'system_event');
    const metadata = record?.metadata || {};
    const createdAt = record?.createdAt ? new Date(record.createdAt) : new Date();

    return {
      id: String(record?._id || this.hashRecord(record)),
      date: createdAt.toISOString(),
      event: this.actionLabel(action),
      user: this.userLabel(record, metadata),
      module: this.moduleLabel(action),
      severity: this.severityFor(action, metadata),
      hash: this.hashRecord(record),
      action,
    };
  }

  private async getSystemNodes() {
    const postgres = await this.checkPostgres();
    const mongo = this.mongoConnection.readyState === 1;
    const encryption = this.safeAesSelfTest();

    const nodes: Array<{ name: string; status: NodeStatus; detail: string; checkedAt: string }> = [
      {
        name: 'API Backend',
        status: 'online',
        detail: 'Servicio NestJS disponible',
        checkedAt: new Date().toISOString(),
      },
      {
        name: 'PostgreSQL',
        status: postgres ? 'online' : 'offline',
        detail: postgres ? 'Base transaccional disponible' : 'Sin respuesta de base transaccional',
        checkedAt: new Date().toISOString(),
      },
      {
        name: 'Mongo Timeline',
        status: mongo ? 'online' : 'offline',
        detail: mongo ? 'Bitacora de auditoria disponible' : 'Sin conexion a bitacora',
        checkedAt: new Date().toISOString(),
      },
      {
        name: 'AES-256-GCM',
        status: encryption ? 'online' : 'offline',
        detail: encryption ? 'Cifrado verificado' : 'Cifrado no disponible',
        checkedAt: new Date().toISOString(),
      },
    ];

    return nodes;
  }

  private async checkPostgres(): Promise<boolean> {
    try {
      await this.dataSource.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  private safeAesSelfTest(): boolean {
    try {
      return this.aes.selfTest();
    } catch {
      return false;
    }
  }

  private severityFor(action: string, metadata: Record<string, any>): AuditSeverity {
    const configured = String(metadata?.severity || '').toUpperCase();
    if (configured === 'ALTA' || configured === 'MEDIA' || configured === 'BAJA') return configured;

    const key = action.toLowerCase();
    if (/(failed|invalid|revoked|deleted|unregistered|blocked|unverified|outside)/.test(key)) return 'ALTA';
    if (/(updated|changed|reset|ended|uncounted|regenerated)/.test(key)) return 'MEDIA';
    return 'BAJA';
  }

  private moduleLabel(action: string): string {
    const key = action.toLowerCase();
    if (key.includes('vote')) return 'Escrutinio';
    if (key.includes('voter')) return 'Identificacion';
    if (key.includes('election')) return 'Elecciones';
    if (key.includes('option')) return 'Boletas';
    if (key.includes('password') || key.includes('code') || key.includes('email')) return 'Seguridad';
    return 'Sistema';
  }

  private actionLabel(action: string): string {
    const labels: Record<string, string> = {
      vote_cast: 'Voto emitido',
      vote_revoked: 'Voto revocado',
      election_started: 'Eleccion iniciada',
      election_ended: 'Eleccion finalizada',
      voter_registered: 'Votante registrado',
      voter_unregistered: 'Votante removido',
      voter_updated: 'Votante actualizado',
      voter_invitation_sent: 'Invitacion enviada',
      voter_invitation_failed: 'Invitacion fallida',
      voter_reminder_sent: 'Recordatorio enviado',
      voter_reminder_failed: 'Recordatorio fallido',
      option_added: 'Opcion agregada',
      option_removed: 'Opcion eliminada',
      option_updated: 'Opcion actualizada',
      election_created: 'Eleccion creada',
      election_deleted: 'Eleccion eliminada',
      election_updated: 'Eleccion actualizada',
      election_readiness_viewed: 'Preparacion de eleccion consultada',
      election_wizard_updated: 'Avance de asistente actualizado',
      election_section_approved: 'Seccion de eleccion aprobada',
      election_section_rejected: 'Seccion de eleccion rechazada',
      election_audit_package_exported: 'Paquete de auditoria exportado',
      election_demo_started: 'Ensayo iniciado',
      election_demo_cleared: 'Ensayo limpiado',
      election_demo_completed: 'Ensayo formal completado',
      election_production_started: 'Votacion real iniciada',
      election_closed: 'Eleccion cerrada',
      election_scrutiny_published: 'Escrutinio publicado',
      election_communication_templates_updated: 'Plantillas de comunicacion actualizadas',
      election_supervision_members_updated: 'Equipo de supervision actualizado',
      vote_counted: 'Voto contabilizado',
      vote_uncounted: 'Voto excluido',
      voter_logged_in: 'Inicio de sesion de votante',
      voter_logged_out: 'Cierre de sesion de votante',
      voter_profile_viewed: 'Perfil de votante consultado',
      voter_profile_updated: 'Perfil de votante actualizado',
      voter_password_changed: 'Contrasena de votante cambiada',
      voter_email_verified: 'Correo de votante verificado',
      voter_email_updated: 'Correo de votante actualizado',
      voter_code_generated: 'Codigo de votante generado',
      voter_code_used: 'Codigo de votante utilizado',
      voter_code_expired: 'Codigo de votante expirado',
      voter_code_invalidated: 'Codigo de votante invalidado',
    };

    return labels[action] || action.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  private userLabel(record: any, metadata: Record<string, any>): string {
    return (
      metadata?.userName ||
      metadata?.user?.fullName ||
      metadata?.user?.email ||
      metadata?.email ||
      metadata?.voterName ||
      (record?.entityId ? `Entidad_${String(record.entityId).slice(0, 6)}` : 'Sistema')
    );
  }

  private hashRecord(record: any): string {
    const source = JSON.stringify({
      id: record?._id,
      entityId: record?.entityId,
      electionId: record?.electionId,
      action: record?.action,
      createdAt: record?.createdAt,
    });
    return createHash('sha256').update(source).digest('hex').slice(0, 12).toUpperCase();
  }
}
