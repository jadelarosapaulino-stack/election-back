import { Injectable, Logger } from '@nestjs/common';
import { EmailQueueService, SendEmailOptions } from './email-queue.service';
import { EmailTemplateData } from './email-template.service';

export interface GdprBreachEmailData extends EmailTemplateData {
  breachId: string;
  type: string;
  severity: string;
  affectedUsers: number;
  dataCategories: string;
  detectedAt: string;
  description: string;
  dpoEmail: string;
  authorityNotification?: string;
  subjectNotification?: string;
  authorityName?: string;
  notifiedAt?: string;
}

export interface GdprDeadlineEmailData extends EmailTemplateData {
  breachId: string;
  type: string;
  severity: string;
  affectedUsers: number;
  hoursSinceDetection: string;
  urgency: 'CRÍTICO' | 'URGENTE';
  deadlineTitle: string;
  deadlineStatus: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly emailQueueService: EmailQueueService) {}

  async sendVerificationCode(email: string, code: string, ttlMinutes = 15) {
    return this.sendEmail({
      to: email,
      subject: '',
      template: 'verification-code',
      data: { code, expiresIn: this.normalizeTtl(ttlMinutes) },
    });
  }

  async sendPasswordResetCode(email: string, code: string, ttlMinutes = 15) {
    return this.sendEmail({
      to: email,
      subject: '',
      template: 'password-reset',
      data: { code, expiresIn: this.normalizeTtl(ttlMinutes) },
    });
  }

  async sendVoterAccessCode(
    email: string,
    electionTitle: string,
    code: string,
    ttlMinutes: number,
    singleUse: boolean,
  ) {
    return this.sendEmail({
      to: email,
      subject: '',
      template: 'voter-access-code',
      data: {
        electionTitle,
        code,
        expiresIn: this.normalizeTtl(ttlMinutes),
        singleUse,
      },
    });
  }

  async sendVoterInvitation(
    email: string,
    electionTitle: string,
    portalUrl: string,
  ) {
    return this.sendEmail({
      to: email,
      subject: '',
      template: 'voter-invitation',
      data: { electionTitle, portalUrl },
    });
  }

  async sendConfiguredVoterInvitation(
    email: string,
    subject: string,
    html: string,
  ) {
    return this.sendWrappedContent(
      email,
      subject,
      html,
      'voter-custom-invitation',
    );
  }

  async sendVoterReminder(email: string, subject: string, html: string) {
    return this.sendWrappedContent(email, subject, html, 'voter-reminder');
  }

  async sendGdprDpoNotification(email: string, data: GdprBreachEmailData) {
    return this.sendEmail({
      to: email,
      subject: '',
      template: 'gdpr-dpo-notification',
      data,
      metadata: { type: 'gdpr-dpo-notification', breachId: data.breachId },
    });
  }

  async sendGdprAuthorityNotification(
    email: string,
    data: GdprBreachEmailData,
  ) {
    return this.sendEmail({
      to: email,
      subject: '',
      template: 'gdpr-authority-notification',
      data,
      metadata: {
        type: 'gdpr-authority-notification',
        breachId: data.breachId,
      },
    });
  }

  async sendGdprSubjectNotification(email: string, data: GdprBreachEmailData) {
    return this.sendEmail({
      to: email,
      subject: '',
      template: 'gdpr-subject-notification',
      data,
      metadata: {
        type: 'gdpr-subject-notification',
        breachId: data.breachId,
      },
    });
  }

  async sendGdprDeadlineAlert(email: string, data: GdprDeadlineEmailData) {
    return this.sendEmail({
      to: email,
      subject: '',
      template: 'gdpr-deadline-alert',
      data,
      metadata: { type: 'gdpr-deadline-alert', breachId: data.breachId },
    });
  }

  /** Kept for operational messages whose content is intentionally free-form. */
  async sendCustomEmail(
    email: string,
    subject: string,
    html: string,
    _fallbackLog: string,
  ) {
    return this.sendWrappedContent(email, subject, html, 'custom');
  }

  async sendBreachNotification(
    email: string,
    description: string,
    severity: string,
    detectedAt: string,
    dpoEmail: string,
  ) {
    return this.sendEmail({
      to: email,
      subject: '',
      template: 'gdpr-breach-notification',
      data: { description, severity, detectedAt, dpoEmail },
      metadata: { type: 'gdpr-breach-notification' },
    });
  }

  private sendWrappedContent(
    email: string,
    subject: string,
    html: string,
    template: string,
  ) {
    return this.sendEmail({
      to: email,
      subject,
      template,
      data: { title: subject, content: html },
    });
  }

  private normalizeTtl(ttlMinutes: number): number {
    return Number.isFinite(ttlMinutes)
      ? Math.max(1, Math.round(ttlMinutes))
      : 15;
  }

  private async sendEmail(options: SendEmailOptions) {
    try {
      return await this.emailQueueService.sendEmail(options);
    } catch (error) {
      this.logger.error(`Failed to queue email to ${options.to}: ${error}`);
      throw error;
    }
  }
}
