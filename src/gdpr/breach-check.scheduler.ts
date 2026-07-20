import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { BreachNotificationService } from './breach-notification.service';
import { EmailService } from '../common/email/email.service';
import type { BreachEvent } from './breach-event.entity';

const SEVENTY_TWO_HOURS_MS = 72 * 60 * 60 * 1000;
const URGENT_THRESHOLD_HOURS = 12;

@Injectable()
export class BreachCheckScheduler {
  private readonly logger = new Logger(BreachCheckScheduler.name);
  private readonly dpoEmail: string;

  constructor(
    private readonly breachService: BreachNotificationService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {
    this.dpoEmail =
      this.configService.get<string>('DPO_EMAIL') || 'dpo@votingsuite.com';
  }

  @Cron('0 * * * *') // Cada hora en punto
  async checkBreachDeadlines(): Promise<void> {
    this.logger.log('Checking breach notification deadlines (Art. 33)...');

    try {
      const pending =
        await this.breachService.findBreachesPendingAuthorityNotification();

      if (pending.length === 0) {
        this.logger.log('No pending authority notifications.');
        return;
      }

      for (const breach of pending) {
        await this.evaluateBreachDeadline(breach);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error checking breach deadlines: ${message}`);
    }
  }

  private async evaluateBreachDeadline(breach: BreachEvent): Promise<void> {
    const hoursSinceDetection = this.hoursSince(breach.detectedAt);
    const msElapsed = Date.now() - new Date(breach.detectedAt).getTime();
    const hoursLeft = (SEVENTY_TWO_HOURS_MS - msElapsed) / (1000 * 60 * 60);

    if (hoursLeft <= 0) {
      // CRÍTICO: plazo excedido
      this.logger.error(
        `CRITICAL: breach ${breach.id} has EXCEEDED 72h deadline ` +
          `(${hoursSinceDetection.toFixed(1)}h since detection)`,
      );
      await this.sendAlert(breach, hoursSinceDetection, true);
    } else if (hoursLeft <= URGENT_THRESHOLD_HOURS) {
      // URGENTE: menos de 12h restantes
      this.logger.warn(
        `URGENT: breach ${breach.id} has ${hoursLeft.toFixed(1)}h left ` +
          `to notify supervisory authority`,
      );
      await this.sendAlert(breach, hoursSinceDetection, false);
    } else {
      // INFO: dentro del plazo
      this.logger.log(
        `Breach ${breach.id}: ${hoursLeft.toFixed(
          1,
        )}h remaining for authority notification`,
      );
    }
  }

  private async sendAlert(
    breach: BreachEvent,
    hoursSinceDetection: number,
    exceeded: boolean,
  ): Promise<void> {
    try {
      await this.emailService.sendGdprDeadlineAlert(this.dpoEmail, {
        breachId: breach.id,
        type: breach.type,
        severity: breach.severity.toUpperCase(),
        affectedUsers: breach.affectedUsers,
        hoursSinceDetection: `${hoursSinceDetection.toFixed(1)} h`,
        urgency: exceeded ? 'CRÍTICO' : 'URGENTE',
        deadlineTitle: exceeded
          ? 'El plazo de 72 horas fue excedido'
          : 'El plazo de 72 horas está por vencer',
        deadlineStatus: exceeded
          ? 'Plazo excedido'
          : `Quedan menos de ${URGENT_THRESHOLD_HOURS} horas`,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to send urgent alert for breach ${breach.id}: ${message}`,
      );
    }
  }

  private hoursSince(date: Date): number {
    return (Date.now() - new Date(date).getTime()) / (1000 * 60 * 60);
  }
}
