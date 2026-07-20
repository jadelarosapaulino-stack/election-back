import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { MonitoringService } from '../monitoring.service';
import { anonymizeIp } from '../../common/utils/anonymize-ip.util';

@Injectable()
export class ApiRequestLogsInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ApiRequestLogsInterceptor.name);

  constructor(private readonly monitoring: MonitoringService) {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  intercept(context: ExecutionContext, next: CallHandler): any {
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();
    const start = Date.now();
    const method = req.method;
    const path = req.originalUrl || req.url;

    // Use pipe with tap to avoid double-execution.
    // We use require() instead of import to avoid the rxjs version mismatch
    // between apps/backend/node_modules (7.8.1) and root node_modules (7.8.2).
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { tap } = require('rxjs/operators');

    return (next.handle() as any).pipe(
      tap({
        next: () => {
          this.captureRequest(method, path, start, req, res.statusCode);
        },
        error: (err: unknown) => {
          this.captureError(method, path, start, req, err);
        },
      }),
    );
  }

  private captureRequest(
    method: string,
    path: string,
    start: number,
    req: Record<string, unknown>,
    statusCode: number,
  ): void {
    const latencyMs = Date.now() - start;
    const headers = req['headers'] as Record<string, string> | undefined;
    this.monitoring.logRequest({
      method,
      path,
      statusCode,
      latencyMs,
      ipAddress: anonymizeIp((req['ip'] as string) || null),
      userAgent: headers?.['user-agent'],
    });
  }

  private captureError(
    method: string,
    path: string,
    start: number,
    req: Record<string, unknown>,
    err: unknown,
  ): void {
    const error = err as { status?: number; statusCode?: number; message?: string; stack?: string } | undefined;
    const latencyMs = Date.now() - start;
    const statusCode = error?.status || error?.statusCode || 500;
    const headers = req['headers'] as Record<string, string> | undefined;
    this.monitoring.logRequest({
      method,
      path,
      statusCode,
      latencyMs,
      ipAddress: anonymizeIp((req['ip'] as string) || null),
      userAgent: headers?.['user-agent'],
    });
    this.monitoring.logError({
      severity: statusCode >= 500 ? 'error' : 'warn',
      service: 'API Backend',
      message: error?.message || 'Unknown error',
      stackTrace: error?.stack,
      context: { method, path, statusCode },
    });
  }
}
