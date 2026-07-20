import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Election } from './entities/election.entity';
import { StatusType } from 'src/utils/status-type.enum';
import { ElectionConfig, ElectionRunMode } from './election-config/entities/election-config.entity';
import { ElectionsService } from './elections.service';

@Injectable()
export class ElectionStatusJob implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('ElectionStatusJob');
  private interval: NodeJS.Timeout | null = null;
  private running = false;
  private readonly intervalMs = 10_000;

  constructor(
    @InjectRepository(Election)
    private readonly electionRepository: Repository<Election>,
    @InjectRepository(ElectionConfig)
    private readonly configRepository: Repository<ElectionConfig>,
    private readonly electionsService: ElectionsService,
  ) {}

  onModuleInit(): void {
    this.interval = setInterval(() => this.syncStatuses(), this.intervalMs);
    void this.syncStatuses();
  }

  onModuleDestroy(): void {
    if (this.interval) clearInterval(this.interval);
  }

  private async syncStatuses(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const now = new Date();
      const configs = await this.configRepository.find({
        relations: ['election'],
      });

      let startedCount = 0;
      let completedCount = 0;
      let incompleteCount = 0;
      let reactivatedCount = 0;
      let promotedFromDemoCount = 0;

      for (const config of configs) {
        const election = config.election;
        if (!election) continue;
        if (
          election.status === StatusType.COMPLETED ||
          election.status === StatusType.INACTIVE ||
          election.status === StatusType.SUSPENDED
        ) {
          continue;
        }

        const startAt = config.startAt || election.startDate || null;
        const endAt = config.endAt || election.endDate || null;
        const nowTs = now.getTime();

        const startTs = this.toTimestamp(startAt);
        const endTs = this.toTimestamp(endAt);
        const readiness = await this.electionsService.getAutomationReadiness(election.id);
        const isReady = Boolean(readiness.ready);
        const scheduledFor = startTs ? new Date(startTs).toISOString() : null;
        const extra = this.asRecord(config.extra);
        const automaticStartBlocked = this.asRecord(extra.automaticStartBlocked);
        const isBlockedForCurrentSchedule = Boolean(
          scheduledFor && automaticStartBlocked.scheduledFor === scheduledFor,
        );

        if (!startTs || nowTs < startTs) {
          if (extra.automaticStartBlocked) {
            const { automaticStartBlocked: _blocked, ...restExtra } = extra;
            await this.configRepository.update(config.id, { extra: restExtra });
          }
          if (isReady && election.status === StatusType.INCOMPLETE) {
            await this.electionRepository.update(election.id, {
              status: StatusType.ACTIVE,
              updatedAt: now,
            });
            reactivatedCount += 1;
          }
          continue;
        }

        if (endTs && nowTs >= endTs) {
          const nextStatus = election.status === StatusType.RUNNING
            ? StatusType.COMPLETED
            : StatusType.INCOMPLETE;

          await this.electionRepository.update(election.id, {
            status: nextStatus,
            updatedAt: now,
          });

          if (nextStatus === StatusType.COMPLETED) {
            completedCount += 1;
          } else {
            await this.persistAutomaticStartBlock(config, readiness, scheduledFor, now);
            incompleteCount += 1;
          }
          continue;
        }

        if (isBlockedForCurrentSchedule) {
          if (election.status !== StatusType.INCOMPLETE) {
            await this.electionRepository.update(election.id, {
              status: StatusType.INCOMPLETE,
              updatedAt: now,
            });
          }
          continue;
        }

        if (!isReady) {
          await this.persistAutomaticStartBlock(config, readiness, scheduledFor, now);
          if (election.status !== StatusType.INCOMPLETE) {
            await this.electionRepository.update(election.id, {
              status: StatusType.INCOMPLETE,
              updatedAt: now,
            });
            incompleteCount += 1;
          }
          continue;
        }

        if (config.runMode === ElectionRunMode.DEMO) {
          await this.configRepository.update(config.id, {
            runMode: ElectionRunMode.PRODUCTION,
          });
          promotedFromDemoCount += 1;
        }

        if (election.status !== StatusType.RUNNING) {
          await this.electionRepository.update(election.id, {
            status: StatusType.RUNNING,
            updatedAt: now,
          });
          startedCount += 1;
        }
      }

      if (startedCount) {
        this.logger.log(`Marked ${startedCount} election(s) as running`);
      }
      if (completedCount) {
        this.logger.log(`Marked ${completedCount} election(s) as completed`);
      }
      if (incompleteCount) {
        this.logger.warn(`Marked ${incompleteCount} election(s) as incomplete`);
      }
      if (reactivatedCount) {
        this.logger.log(`Marked ${reactivatedCount} corrected election(s) as active`);
      }
      if (promotedFromDemoCount) {
        this.logger.log(`Promoted ${promotedFromDemoCount} scheduled election(s) from demo to production`);
      }
    } catch (error) {
      this.logger.error('Failed to update election statuses', error as Error);
    } finally {
      this.running = false;
    }
  }

  private async persistAutomaticStartBlock(
    config: ElectionConfig,
    readiness: any,
    scheduledFor: string | null,
    now: Date,
  ): Promise<void> {
    const extra = this.asRecord(config.extra);
    const existing = this.asRecord(extra.automaticStartBlocked);
    if (existing.scheduledFor === scheduledFor) return;
    const pendingRequirements = (readiness.requirements || [])
      .filter((item: any) => !item.done)
      .map((item: any) => item.key);
    const pendingApprovals = (readiness.approvals || [])
      .filter((item: any) => item.status !== 'approved')
      .map((item: any) => item.section);
    await this.configRepository.update(config.id, {
      extra: {
        ...extra,
        automaticStartBlocked: {
          scheduledFor,
          blockedAt: now.toISOString(),
          pendingRequirements,
          pendingApprovals,
        },
      } as any,
    });
  }

  private asRecord(value: unknown): Record<string, any> {
    return value && typeof value === 'object' ? (value as Record<string, any>) : {};
  }

  private toTimestamp(value: Date | null): number | null {
    if (!value) return null;
    const timestamp = value.getTime();
    return Number.isFinite(timestamp) ? timestamp : null;
  }
}
