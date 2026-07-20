import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  EmailDelivery,
  EmailStatus,
} from './entities/email-delivery.entity';
import {
  EmailTemplateService,
  EmailTemplateData,
} from './email-template.service';

export interface SendEmailOptions {
  to: string;
  subject: string;
  template: string;
  data: EmailTemplateData;
  from?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class EmailQueueService {
  private readonly logger = new Logger(EmailQueueService.name);

  constructor(
    @InjectQueue('email-send')
    private readonly emailQueue: Queue,
    @InjectRepository(EmailDelivery)
    private readonly deliveryRepo: Repository<EmailDelivery>,
    private readonly templateService: EmailTemplateService,
  ) {}

  async sendEmail(
    options: SendEmailOptions,
  ): Promise<EmailDelivery> {
    const { to, subject, template, data, from, metadata } = options;

    // Resolve subject from template if caller didn't provide one
    const emailSubject =
      subject ||
      (await this.templateService.getSubject(template, data));

    // Create delivery record with the resolved subject
    const delivery = this.deliveryRepo.create({
      to,
      from: from || 'no-reply@votingsuite.com',
      subject: emailSubject,
      status: EmailStatus.QUEUED,
      template,
      metadata,
      attempts: 0,
      maxAttempts: 3,
    });

    const savedDelivery = await this.deliveryRepo.save(delivery);

    // Render template from DB (async)
    const html = await this.templateService.render(template, data);

    if (!html) {
      this.logger.error(
        `Template "${template}" rendered empty`,
      );
      await this.deliveryRepo.update(savedDelivery.id, {
        status: EmailStatus.FAILED,
        errorMessage: `Template "${template}" not found or empty`,
      });
      return savedDelivery;
    }

    // Add to queue
    await this.emailQueue.add(
      {
        deliveryId: savedDelivery.id,
        to,
        subject: emailSubject,
        html,
        from,
      },
      {
        jobId: `email-${savedDelivery.id}`,
      },
    );

    this.logger.log(
      `Email queued: ${savedDelivery.id} → ${to}`,
    );
    return savedDelivery;
  }

  async getDeliveryStatus(
    id: string,
  ): Promise<EmailDelivery | null> {
    return this.deliveryRepo.findOne({ where: { id } });
  }

  async getDeliveriesByRecipient(
    email: string,
    limit = 50,
  ): Promise<EmailDelivery[]> {
    return this.deliveryRepo.find({
      where: { to: email },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async getDeliveryStats(): Promise<{
    total: number;
    sent: number;
    failed: number;
    pending: number;
  }> {
    const [total, sent, failed, pending] = await Promise.all([
      this.deliveryRepo.count(),
      this.deliveryRepo.count({
        where: { status: EmailStatus.SENT },
      }),
      this.deliveryRepo.count({
        where: { status: EmailStatus.FAILED },
      }),
      this.deliveryRepo.count({
        where: { status: EmailStatus.QUEUED },
      }),
    ]);

    return { total, sent, failed, pending };
  }

  async retryFailed(deliveryId: string): Promise<boolean> {
    const delivery = await this.deliveryRepo.findOne({
      where: { id: deliveryId },
    });
    if (!delivery || delivery.status !== EmailStatus.FAILED) {
      return false;
    }

    // Re-render template (async)
    const html = await this.templateService.render(
      delivery.template,
      (delivery.metadata as Record<string, unknown>) || {},
    );

    if (!html) {
      this.logger.error(
        `Cannot retry ${deliveryId}: template "${delivery.template}" rendered empty`,
      );
      return false;
    }

    await this.emailQueue.add({
      deliveryId: delivery.id,
      to: delivery.to,
      subject: delivery.subject,
      html,
    });

    await this.deliveryRepo.update(deliveryId, {
      status: EmailStatus.QUEUED,
    });
    this.logger.log(`Retrying failed email: ${deliveryId}`);
    return true;
  }
}
