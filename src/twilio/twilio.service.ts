import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TwilioConfig } from './entities/twilio-config.entity';
import { UpdateTwilioConfigDto } from './dto/update-twilio-config.dto';
import { Aes256GcmService, Aes256GcmEncryptedPayload } from '../common/security/aes-256-gcm.service';

@Injectable()
export class TwilioService {
  private readonly logger = new Logger(TwilioService.name);

  constructor(
    @InjectRepository(TwilioConfig)
    private readonly twilioRepo: Repository<TwilioConfig>,
    private readonly aes: Aes256GcmService,
  ) {}

  async getConfig(): Promise<TwilioConfig> {
    const configs = await this.twilioRepo.find({ take: 1, order: { createdAt: 'DESC' } });
    if (configs.length === 0) {
      const defaultConfig = this.twilioRepo.create({
        enabled: false,
        useSandbox: false,
        accountSid: '',
        authToken: '',
        defaultCountryCode: '+1',
      });
      return this.twilioRepo.save(defaultConfig);
    }

    const config = configs[0];
    // Decrypt authToken if it was stored encrypted
    if (config.authToken) {
      config.authToken = this.decryptAuthToken(config.authToken);
    }
    return config;
  }

  async updateConfig(dto: UpdateTwilioConfigDto): Promise<TwilioConfig> {
    const config = await this.getConfig();

    // Apply non-authToken fields from DTO
    const { authToken, ...rest } = dto;
    Object.assign(config, rest);

    // H-10: Handle authToken separately — encrypt on save
    if (authToken !== undefined && authToken !== null && authToken !== '') {
      // New value provided — encrypt it
      config.authToken = this.encryptAuthToken(authToken);
    } else if (authToken === '' || authToken === null) {
      // Explicitly clearing authToken
      config.authToken = '';
    }
    // If authToken is undefined (not in DTO), config.authToken is already decrypted
    // from getConfig(). Re-encrypt it before saving so DB always has encrypted form.
    if (authToken === undefined && config.authToken) {
      config.authToken = this.encryptAuthToken(config.authToken);
    }

    config.updatedAt = new Date();
    return this.twilioRepo.save(config);
  }

  async testConnection(): Promise<{ ok: boolean; message: string }> {
    const config = await this.getConfig();
    if (!config.accountSid || !config.authToken) {
      return { ok: false, message: 'Twilio no configurado: faltan Account SID o Auth Token.' };
    }
    try {
      const auth = Buffer.from(`${config.accountSid}:${config.authToken}`).toString('base64');
      const resp = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}.json`,
        { headers: { Authorization: `Basic ${auth}` } },
      );
      if (!resp.ok) {
        return { ok: false, message: `Error de conexion: ${resp.statusText}` };
      }
      return { ok: true, message: 'Conexion con Twilio verificada.' };
    } catch {
      return { ok: false, message: 'No se pudo conectar con Twilio.' };
    }
  }

  /**
   * Encrypt an authToken string using AES-256-GCM.
   * Returns a JSON-serialized encrypted payload.
   */
  private encryptAuthToken(plainToken: string): string {
    try {
      const payload = this.aes.encryptJson({ value: plainToken });
      return JSON.stringify(payload);
    } catch (err) {
      this.logger.error('Failed to encrypt Twilio authToken, storing as plaintext');
      return plainToken;
    }
  }

  /**
   * Decrypt an authToken. If the value is not a valid encrypted payload,
   * returns it as-is (backward compatibility with pre-encryption data).
   */
  private decryptAuthToken(stored: string): string {
    try {
      const parsed = JSON.parse(stored) as Aes256GcmEncryptedPayload;
      if (parsed.alg === 'AES-256-GCM' && parsed.iv && parsed.tag && parsed.ciphertext) {
        const decrypted = this.aes.decryptJson<{ value: string }>(parsed);
        return decrypted.value;
      }
      // Not an encrypted payload — return as-is (legacy plaintext)
      return stored;
    } catch {
      // Not valid JSON or decryption failed — return as-is (legacy plaintext)
      return stored;
    }
  }
}
