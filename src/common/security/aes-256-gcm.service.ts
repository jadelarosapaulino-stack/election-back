import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

export interface Aes256GcmEncryptedPayload {
  alg: 'AES-256-GCM';
  iv: string;
  tag: string;
  ciphertext: string;
}

@Injectable()
export class Aes256GcmService {
  readonly algorithm = 'AES-256-GCM' as const;
  private readonly key = this.resolveKey();

  encryptJson(value: unknown): Aes256GcmEncryptedPayload {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const plaintext = Buffer.from(JSON.stringify(value), 'utf8');
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();

    return {
      alg: this.algorithm,
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      ciphertext: ciphertext.toString('base64'),
    };
  }

  decryptJson<T = unknown>(payload: Aes256GcmEncryptedPayload): T {
    if (payload.alg !== this.algorithm) {
      throw new Error(`Unsupported encryption algorithm: ${payload.alg}`);
    }
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.key,
      Buffer.from(payload.iv, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(payload.ciphertext, 'base64')),
      decipher.final(),
    ]);
    return JSON.parse(plaintext.toString('utf8')) as T;
  }

  selfTest(): boolean {
    const sample = { status: 'ok', ts: 1 };
    const encrypted = this.encryptJson(sample);
    const decrypted = this.decryptJson<typeof sample>(encrypted);
    return decrypted.status === sample.status && decrypted.ts === sample.ts;
  }

  private resolveKey(): Buffer {
    const configured = process.env.VOTE_ENCRYPTION_KEY || process.env.APP_ENCRYPTION_KEY || '';
    if (configured) {
      const decoded = this.decodeConfiguredKey(configured);
      return decoded.length === 32 ? decoded : createHash('sha256').update(decoded).digest();
    }

    const fallbackMaterial = [
      process.env.JWT_SECRET,
      process.env.VOTER_JWT_SECRET,
      process.env.DB_PASSWORD,
      process.env.MONGO_URI,
    ]
      .filter(Boolean)
      .join('|');

    if (!fallbackMaterial) {
      throw new Error('VOTE_ENCRYPTION_KEY or equivalent secret material is required for AES-256-GCM.');
    }

    return createHash('sha256').update(fallbackMaterial).digest();
  }

  private decodeConfiguredKey(value: string): Buffer {
    const trimmed = value.trim();
    if (/^[a-f0-9]{64}$/i.test(trimmed)) return Buffer.from(trimmed, 'hex');
    try {
      const base64 = Buffer.from(trimmed, 'base64');
      if (base64.length > 0) return base64;
    } catch {
      // Fall back to UTF-8 below.
    }
    return Buffer.from(trimmed, 'utf8');
  }
}
