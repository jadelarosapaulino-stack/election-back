import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserConsent } from '../auth/entities/user-consent.entity';

@Injectable()
export class CookieConsentService {
  private readonly logger = new Logger(CookieConsentService.name);

  constructor(
    @InjectRepository(UserConsent)
    private readonly consentRepo: Repository<UserConsent>,
  ) {}

  /**
   * Registra una preferencia de cookies para un usuario.
   * Revoca previas preferencias cookie antes de crear la nueva.
   */
  async register(
    userId: string,
    dto: { categories: string[]; version: string; ipAddress?: string },
  ): Promise<UserConsent> {
    // Revocar preferencias cookie anteriores del usuario
    const revokeResult = await this.consentRepo.update(
      { user: { id: userId }, consentType: 'cookie_preferences' },
      { revoked: true, revokedAt: new Date() },
    );

    if (revokeResult.affected && revokeResult.affected > 0) {
      this.logger.log(
        `Revoked ${revokeResult.affected} previous cookie consent(s) for user ${userId}`,
      );
    }

    const consent = this.consentRepo.create({
      user: { id: userId },
      consentType: 'cookie_preferences',
      policyVersion: dto.version,
      acceptedAt: new Date(),
      ipAddress: dto.ipAddress,
      revoked: false,
    });

    const saved = await this.consentRepo.save(consent);
    this.logger.log(
      `Cookie consent registered for user ${userId}: categories=${dto.categories.join(',')}, version=${dto.version}`,
    );

    return saved;
  }

  /**
   * Obtiene la preferencia de cookies activa más reciente del usuario.
   */
  async getLatest(userId: string): Promise<UserConsent | null> {
    return this.consentRepo.findOne({
      where: {
        user: { id: userId },
        consentType: 'cookie_preferences',
        revoked: false,
      },
      order: { acceptedAt: 'DESC' },
    });
  }

  /**
   * Revoca la preferencia de cookies activa del usuario.
   */
  async revoke(userId: string): Promise<void> {
    const result = await this.consentRepo.update(
      {
        user: { id: userId },
        consentType: 'cookie_preferences',
        revoked: false,
      },
      { revoked: true, revokedAt: new Date() },
    );

    if (result.affected && result.affected > 0) {
      this.logger.log(`Cookie consent revoked for user ${userId}`);
    }
  }
}
