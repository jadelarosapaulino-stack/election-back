import {
  HttpException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PaymentsAdminService {
  private readonly paymentsApiUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.paymentsApiUrl = this.configService
      .get<string>('PAYMENTS_API_URL', 'http://localhost:4010/api')
      .replace(/\/$/, '');
  }

  listPrices() {
    return this.request('/payments/admin/prices');
  }

  upsertPrice(payload: Record<string, unknown>) {
    return this.request('/payments/admin/prices', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  reorderPrices(payload: { priceIds: string[] }) {
    return this.request('/payments/admin/prices/order', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  deactivatePrice(priceId: string) {
    return this.request(
      `/payments/admin/prices/${encodeURIComponent(priceId)}`,
      {
        method: 'DELETE',
      },
    );
  }

  private async request(
    path: string,
    init: RequestInit = {},
  ): Promise<unknown> {
    const apiKey = this.configService.get<string>('PAYMENTS_ADMIN_API_KEY');
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'Payments admin API key is not configured',
      );
    }

    let response: Response;
    try {
      response = await fetch(`${this.paymentsApiUrl}${path}`, {
        ...init,
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          ...init.headers,
        },
      });
    } catch {
      throw new ServiceUnavailableException('Payments service is unavailable');
    }

    const text = await response.text();
    const payload = text ? this.parsePayload(text) : null;
    if (!response.ok) {
      const message =
        this.readErrorMessage(payload) || 'Payments request failed';
      throw new HttpException(message, response.status);
    }

    return payload;
  }

  private parsePayload(text: string): unknown {
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return text;
    }
  }

  private readErrorMessage(payload: unknown): string | null {
    if (typeof payload === 'string') return payload;
    if (!payload || typeof payload !== 'object') return null;
    const message = (payload as { message?: unknown }).message;
    if (Array.isArray(message)) return message.join(', ');
    return typeof message === 'string' ? message : null;
  }
}
