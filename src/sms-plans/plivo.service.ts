import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface PlivoPingResult {
  ok: boolean;
  status?: number;
  error?: string;
}

@Injectable()
export class PlivoService {
  private readonly authId: string | undefined;
  private readonly authToken: string | undefined;
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.authId = this.configService.get<string>('PLIVO_AUTH_ID');
    this.authToken = this.configService.get<string>('PLIVO_AUTH_TOKEN');
    this.baseUrl = this.configService.get<string>('PLIVO_BASE_URL') || 'https://api.plivo.com/v1';
  }

  isConfigured(): boolean {
    return Boolean(this.authId && this.authToken);
  }

  maskedAuthId(): string | null {
    if (!this.authId) return null;
    if (this.authId.length <= 6) return `${this.authId.slice(0, 2)}***`;
    return `${this.authId.slice(0, 4)}...${this.authId.slice(-2)}`;
  }

  async ping(): Promise<PlivoPingResult> {
    if (!this.isConfigured()) {
      return { ok: false, error: 'PLIVO_AUTH_ID/PLIVO_AUTH_TOKEN no configurados.' };
    }
    const url = `${this.baseUrl}/Account/${this.authId}/`;
    try {
      const auth = Buffer.from(`${this.authId}:${this.authToken}`).toString('base64');
      const resp = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Basic ${auth}`,
        },
      });
      if (!resp.ok) {
        return { ok: false, status: resp.status, error: 'No se pudo validar la cuenta Plivo.' };
      }
      return { ok: true, status: resp.status };
    } catch (error) {
      return { ok: false, error: 'Error al conectar con Plivo.' };
    }
  }
}
