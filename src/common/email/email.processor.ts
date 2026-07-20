import {
  Process,
  Processor,
  OnQueueFailed,
  OnQueueCompleted,
} from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import * as nodemailer from 'nodemailer';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailDelivery, EmailStatus } from './entities/email-delivery.entity';
import { SystemConfigService } from '../../system-config/system-config.service';

export interface EmailJobData {
  deliveryId: string;
  to: string;
  subject: string;
  html: string;
  from?: string;
}

@Processor('email-send')
export class EmailProcessor {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(
    @InjectRepository(EmailDelivery)
    private readonly deliveryRepo: Repository<EmailDelivery>,
    private readonly systemConfigService: SystemConfigService,
  ) {}

  @Process()
  async handleSend(job: Job<EmailJobData>): Promise<void> {
    const { deliveryId, to, subject, html, from } = job.data;
    this.logger.log(`Processing email job ${job.id} for ${to}`);

    await this.deliveryRepo.update(deliveryId, {
      status: EmailStatus.SENDING,
    });

    const smtpConfig = await this.systemConfigService.getEmailSmtpConfig();

    if (!smtpConfig.enabled || !smtpConfig.host) {
      this.logger.warn(`[DRY RUN] Email to ${to}: ${subject}`);
      await this.deliveryRepo.update(deliveryId, {
        status: EmailStatus.SENT,
        sentAt: new Date(),
        attempts: job.attemptsMade + 1,
      });
      return;
    }

    // Create a fresh transporter each time so config changes
    // (made via admin API) take effect without app restart.
    const transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure,
      requireTLS: smtpConfig.requireTls,
      auth:
        smtpConfig.user || smtpConfig.pass
          ? { user: smtpConfig.user, pass: smtpConfig.pass }
          : undefined,
    });

    const fromEmail = from || smtpConfig.fromEmail;
    const fromName = smtpConfig.fromName;

    try {
      const info = await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to,
        subject,
        html,
      });

      this.logger.log(`Email sent to ${to}: ${info.messageId}`);

      await this.deliveryRepo.update(deliveryId, {
        status: EmailStatus.SENT,
        sentAt: new Date(),
        attempts: job.attemptsMade + 1,
      });
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}: ${error}`);
      throw error; // Bull will retry
    }
  }

  @OnQueueFailed()
  async onFailed(job: Job<EmailJobData>, error: Error): Promise<void> {
    const { deliveryId } = job.data;
    this.logger.error(
      `Email job ${job.id} failed after ${job.attemptsMade} attempts: ${error.message}`,
    );

    await this.deliveryRepo.update(deliveryId, {
      status: EmailStatus.FAILED,
      errorMessage: error.message,
      attempts: job.attemptsMade,
    });
  }

  @OnQueueCompleted()
  async onCompleted(job: Job<EmailJobData>): Promise<void> {
    this.logger.log(`Email job ${job.id} completed successfully`);
  }
}
