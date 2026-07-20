import { TimelineSchema } from './timeline.schema';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TimelineAction } from './timeline.enum';

@Injectable()
export class TimelineService {
  constructor(
    @InjectModel('timeline') private readonly timelineModel: Model<any>,
  ) {}

  async logAction(data: {
    entityId: string;
    electionId: string;
    action: string;
    metadata?: Record<string, any>;
  }) {
    const record = new this.timelineModel(data);
    return await record.save();
  }

  async getTimelineBy(entityId: string) {
    return this.timelineModel.find({ entityId: entityId}).sort({ createdAt: -1 }).exec();
  }

  async getFraudSignalsByElection(
    electionId: string,
    options: { page?: number; pageSize?: number; filter?: 'all' | 'suspicious' } = {},
  ) {
    const page = Math.max(1, Number(options.page) || 1);
    const pageSize = Math.min(50, Math.max(5, Number(options.pageSize) || 10));
    const filter = options.filter === 'suspicious' ? 'suspicious' : 'all';
    const records = await this.timelineModel
      .find({ electionId })
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    const deviceVoteCounts = new Map<string, number>();
    const hourlyVotes = new Map<string, number>();

    for (const record of records as any[]) {
      const metadata = record?.metadata || {};
      if (record.action === TimelineAction.VOTE_CAST && metadata.isDemo !== true) {
        const deviceId = String(metadata.deviceId || '').trim();
        if (deviceId) {
          deviceVoteCounts.set(deviceId, (deviceVoteCounts.get(deviceId) || 0) + 1);
        }
        const date = new Date(record.createdAt);
        if (!Number.isNaN(date.getTime())) {
          date.setMinutes(0, 0, 0);
          const bucket = date.toISOString();
          hourlyVotes.set(bucket, (hourlyVotes.get(bucket) || 0) + 1);
        }
      }
    }

    const hourlyCounts = Array.from(hourlyVotes.values());
    const averageHourlyVotes = hourlyCounts.length
      ? hourlyCounts.reduce((sum, count) => sum + count, 0) / hourlyCounts.length
      : 0;
    const peakHourlyVotes = hourlyCounts.length ? Math.max(...hourlyCounts) : 0;
    const participationSpike = peakHourlyVotes >= 10 && peakHourlyVotes > averageHourlyVotes * 3;
    const repeatedDeviceIds = new Set(
      Array.from(deviceVoteCounts.entries())
        .filter(([, votes]) => votes > 1)
        .map(([deviceId]) => deviceId),
    );
    const repeatedDevices = repeatedDeviceIds.size;
    const suspiciousEvents = (records as any[]).filter((record) => {
      const metadata = this.asRecord(record?.metadata);
      return record.action === TimelineAction.VOTE_CAST
        && metadata.isDemo !== true
        && repeatedDeviceIds.has(String(metadata.deviceId || '').trim());
    });

    const eventMatch: Record<string, any> = { electionId };
    if (filter === 'suspicious') {
      eventMatch.action = TimelineAction.VOTE_CAST;
      eventMatch['metadata.isDemo'] = { $ne: true };
      eventMatch['metadata.deviceId'] = { $in: Array.from(repeatedDeviceIds) };
    }
    const [totalEvents, pagedRecords] = await Promise.all([
      this.timelineModel.countDocuments(eventMatch).exec(),
      this.timelineModel
        .find(eventMatch)
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean()
        .exec(),
    ]);

    const events = (pagedRecords as any[]).map((record) => {
      const metadata = this.asRecord(record?.metadata);
      const deviceId = String(metadata.deviceId || '').trim();
      const repeatedDeviceVote = record.action === TimelineAction.VOTE_CAST
        && metadata.isDemo !== true
        && Boolean(deviceId && repeatedDeviceIds.has(deviceId));

      return {
        id: String(record?._id || ''),
        action: String(record?.action || ''),
        label: this.fraudEventLabel(record?.action),
        description: this.fraudEventDescription(record?.action),
        occurredAt: record?.createdAt || null,
        entityId: record?.entityId ? String(record.entityId) : null,
        severity: repeatedDeviceVote ? 'HIGH' : 'LOW',
        suspicious: repeatedDeviceVote,
        reason: repeatedDeviceVote
          ? 'Se emitieron dos o mas votos reales desde el mismo deviceId.'
          : 'Evento informativo sin coincidencia de deviceId repetido.',
        details: this.sanitizeFraudMetadata(metadata),
      };
    });

    return {
      generatedAt: new Date().toISOString(),
      auditEvents: records.length,
      suspiciousEvents: suspiciousEvents.length,
      repeatedDevices,
      peakHourlyVotes,
      averageHourlyVotes: Number(averageHourlyVotes.toFixed(1)),
      participationSpike,
      criticalAlerts: repeatedDevices,
      lastEventAt: records[0]?.createdAt || null,
      events,
      pagination: {
        page,
        pageSize,
        total: totalEvents,
        totalPages: Math.max(1, Math.ceil(totalEvents / pageSize)),
      },
    };
  }

  private asRecord(value: unknown): Record<string, any> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, any>)
      : {};
  }

  private sanitizeFraudMetadata(metadata: Record<string, any>): Record<string, unknown> {
    const allowedKeys = [
      'deviceId',
      'deviceFingerprint',
      'fingerprint',
      'deviceType',
      'deviceModel',
      'devicePlatform',
      'deviceBrands',
      'coords',
      'address',
      'isDemo',
      'error',
      'changedFields',
      'userName',
      'userEmail',
      'scope',
      'status',
      'notes',
    ];

    return allowedKeys.reduce<Record<string, unknown>>((details, key) => {
      const value = metadata[key];
      if (value !== undefined && value !== null && value !== '') details[key] = value;
      return details;
    }, {});
  }

  private fraudEventLabel(action: string): string {
    const labels: Partial<Record<TimelineAction, string>> = {
      [TimelineAction.VOTE_CAST]: 'Voto emitido',
      [TimelineAction.VOTE_REVOKED]: 'Voto revocado',
      [TimelineAction.VOTE_UNCOUNTED]: 'Voto excluido del conteo',
      [TimelineAction.VOTER_LOGGED_IN]: 'Ingreso de votante',
      [TimelineAction.VOTER_CODE_USED_MULTIPLE]: 'Codigo utilizado varias veces',
      [TimelineAction.VOTER_CODE_USED_OUTSIDE_SESSION]: 'Codigo usado fuera de sesion',
      [TimelineAction.VOTER_INVITATION_FAILED]: 'Fallo al enviar invitacion',
      [TimelineAction.VOTER_REMINDER_FAILED]: 'Fallo al enviar recordatorio',
      [TimelineAction.ELECTION_SECTION_REJECTED]: 'Seccion electoral rechazada',
      [TimelineAction.ELECTION_STARTED]: 'Eleccion iniciada',
      [TimelineAction.ELECTION_ENDED]: 'Eleccion finalizada',
      [TimelineAction.ELECTION_PRODUCTION_STARTED]: 'Produccion iniciada',
      [TimelineAction.ELECTION_CLOSED]: 'Eleccion cerrada',
    };
    return labels[action as TimelineAction] || String(action || 'evento').replace(/_/g, ' ');
  }

  private fraudEventDescription(action: string): string {
    if (action === TimelineAction.VOTE_CAST) return 'Se registro participacion sin revelar la seleccion del votante.';
    if (action === TimelineAction.VOTER_LOGGED_IN) return 'Se registro el acceso de un votante al proceso.';
    if (action === TimelineAction.VOTE_REVOKED || action === TimelineAction.VOTE_UNCOUNTED) {
      return 'El estado de contabilizacion de un voto fue modificado.';
    }
    return 'Evento registrado en la bitacora operativa de la eleccion.';
  }

  async getVoteHotspotsByElection(electionId: string, minVotes = 0, scope: 'REAL' | 'DEMO' = 'REAL') {
    const match: Record<string, any> = {
      electionId,
      action: TimelineAction.VOTE_CAST,
      'metadata.coords.lat': { $exists: true, $ne: null },
      'metadata.coords.lng': { $exists: true, $ne: null },
    };
    if (scope === 'DEMO') {
      match['metadata.isDemo'] = true;
    } else {
      match['metadata.isDemo'] = { $ne: true };
    }

    const results = await this.timelineModel
      .aggregate([
        {
          $match: match,
        },
        {
          $project: {
            lat: { $toDouble: '$metadata.coords.lat' },
            lng: { $toDouble: '$metadata.coords.lng' },
            address: '$metadata.address',
          },
        },
        {
          $group: {
            _id: {
              lat: { $round: ['$lat', 4] },
              lng: { $round: ['$lng', 4] },
            },
            votes: { $sum: 1 },
            address: { $first: '$address' },
          },
        },
        { $match: { votes: { $gt: minVotes } } },
        { $sort: { votes: -1 } },
      ])
      .exec();

    return results.map((row: any) => ({
      lat: row?._id?.lat,
      lng: row?._id?.lng,
      votes: row?.votes || 0,
      address: this.normalizeAddress(row?.address),
    }));
  }

  private normalizeAddress(value: unknown): string | null {
    if (typeof value === 'string') return value.trim() || null;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

    const address = value as Record<string, unknown>;
    for (const key of ['formattedAddress', 'formatted_address', 'displayName', 'display_name', 'label', 'name']) {
      const candidate = address[key];
      if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
    }

    const parts = ['road', 'suburb', 'city', 'state', 'country']
      .map((key) => address[key])
      .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
      .map((part) => part.trim());
    return parts.length ? parts.join(', ') : null;
  }
}
