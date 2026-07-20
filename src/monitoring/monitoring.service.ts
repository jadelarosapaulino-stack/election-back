import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { InjectRepository } from '@nestjs/typeorm';
import { Connection } from 'mongoose';
import { DataSource, Repository, MoreThan, LessThan } from 'typeorm';
import { Aes256GcmService } from '../common/security/aes-256-gcm.service';
import { SystemHealthCheck } from './entities/system-health-check.entity';
import { ApiRequestLog } from './entities/api-request-log.entity';
import { ServiceStatus } from './entities/service-status.entity';
import { ErrorLog } from './entities/error-log.entity';

@Injectable()
export class MonitoringService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MonitoringService.name);
  private readonly startTime = Date.now();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    @InjectRepository(SystemHealthCheck)
    private readonly healthCheckRepo: Repository<SystemHealthCheck>,
    @InjectRepository(ApiRequestLog)
    private readonly requestLogRepo: Repository<ApiRequestLog>,
    @InjectRepository(ServiceStatus)
    private readonly serviceStatusRepo: Repository<ServiceStatus>,
    @InjectRepository(ErrorLog)
    private readonly errorLogRepo: Repository<ErrorLog>,
    @InjectConnection() private readonly mongoConnection: Connection,
    private readonly dataSource: DataSource,
    private readonly aes: Aes256GcmService,
  ) {}

  onModuleInit() {
    // Cleanup old logs every 24 hours
    this.cleanupTimer = setInterval(() => {
      this.cleanupOldLogs(30).catch(() => this.logger.warn('Log cleanup failed'));
    }, 24 * 60 * 60 * 1000);
  }

  onModuleDestroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  // --- Health checks ------------------------------------------------

  async runHealthChecks(): Promise<{
    status: 'healthy' | 'degraded' | 'down';
    checks: Array<{ service: string; status: string; latencyMs: number; message?: string }>;
  }> {
    const checks = await Promise.all([
      this.checkPostgres(),
      this.checkMongoDB(),
      this.checkAES(),
      this.checkAPI(),
    ]);

    const overall = checks.every((c) => c.status === 'healthy')
      ? 'healthy'
      : checks.some((c) => c.status === 'down')
        ? 'down'
        : 'degraded';

    // Persist results
    for (const check of checks) {
      await this.healthCheckRepo.save(
        this.healthCheckRepo.create({
          service: check.service,
          status: check.status,
          latencyMs: check.latencyMs,
          message: check.message || null,
          checkedAt: new Date(),
        }),
      );

      await this.serviceStatusRepo
        .createQueryBuilder()
        .insert()
        .into(ServiceStatus)
        .values({
          serviceName: check.service,
          status: check.status,
          lastCheckedAt: new Date(),
          metadata: { latencyMs: check.latencyMs },
        })
        .orUpdate(['status', 'lastCheckedAt', 'metadata', 'updatedAt'], ['serviceName'])
        .execute();
    }

    return { status: overall, checks };
  }

  private async checkPostgres() {
    const start = Date.now();
    try {
      await this.dataSource.query('SELECT 1');
      return { service: 'PostgreSQL', status: 'healthy', latencyMs: Date.now() - start };
    } catch (err) {
      return { service: 'PostgreSQL', status: 'down', latencyMs: Date.now() - start, message: String(err) };
    }
  }

  private async checkMongoDB() {
    const start = Date.now();
    const ready = this.mongoConnection.readyState === 1;
    return {
      service: 'MongoDB',
      status: ready ? 'healthy' : 'down',
      latencyMs: Date.now() - start,
      message: ready ? 'Connected' : `readyState=${this.mongoConnection.readyState}`,
    };
  }

  private async checkAES() {
    const start = Date.now();
    try {
      const ok = this.aes.selfTest();
      return { service: 'AES-256-GCM', status: ok ? 'healthy' : 'down', latencyMs: Date.now() - start };
    } catch (err) {
      return { service: 'AES-256-GCM', status: 'down', latencyMs: Date.now() - start, message: String(err) };
    }
  }

  private async checkAPI() {
    return { service: 'API Backend', status: 'healthy', latencyMs: 0, message: 'Process alive' };
  }

  // --- Request logging ----------------------------------------------

  async logRequest(entry: { method: string; path: string; statusCode: number; latencyMs: number; ipAddress?: string; userAgent?: string }) {
    try {
      await this.requestLogRepo.save(this.requestLogRepo.create(entry));
    } catch {
      this.logger.warn('Failed to persist request log');
    }
  }

  async logError(entry: { severity: string; service: string; message: string; stackTrace?: string; context?: Record<string, unknown> }) {
    try {
      await this.errorLogRepo.save(this.errorLogRepo.create(entry));
    } catch {
      this.logger.warn('Failed to persist error log');
    }
  }

  // --- Monitoring queries -------------------------------------------

  async getMetrics() {
    const uptimeMs = Date.now() - this.startTime;
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const [totalRequests, errorRequests, avgLatency] = await Promise.all([
      this.requestLogRepo.count({ where: { createdAt: MoreThan(oneHourAgo) } }),
      this.requestLogRepo.count({ where: { createdAt: MoreThan(oneHourAgo), statusCode: MoreThan(399) } }),
      this.requestLogRepo
        .createQueryBuilder('log')
        .select('AVG(log.latencyMs)', 'avg')
        .where('log.createdAt > :since', { since: oneHourAgo })
        .getRawOne(),
    ]);

    const services = await this.serviceStatusRepo.find({ order: { serviceName: 'ASC' } });

    return {
      uptime: { ms: uptimeMs, formatted: this.formatUptime(uptimeMs) },
      requests: {
        totalLastHour: totalRequests,
        errorsLastHour: errorRequests,
        errorRate: totalRequests > 0 ? Math.round((errorRequests / totalRequests) * 10000) / 100 : 0,
      },
      performance: {
        avgLatencyMs: avgLatency?.avg ? Math.round(Number(avgLatency.avg)) : 0,
      },
      services,
    };
  }

  async getServiceStatuses() {
    return this.serviceStatusRepo.find({ order: { serviceName: 'ASC' } });
  }

  async getRequestLogs(page = 1, pageSize = 50) {
    const [items, total] = await this.requestLogRepo.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async getErrorLogs(page = 1, pageSize = 50, severity?: string) {
    const where = severity ? { severity } : {};
    const [items, total] = await this.errorLogRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async cleanupOldLogs(daysToKeep = 30) {
    const cutoff = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
    await this.requestLogRepo.delete({ createdAt: LessThan(cutoff) });
    await this.errorLogRepo.delete({ createdAt: LessThan(cutoff) });
    await this.healthCheckRepo.delete({ checkedAt: LessThan(cutoff) });
  }

  private formatUptime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m ${seconds % 60}s`;
  }
}
