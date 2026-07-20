import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TimelineService } from '../timeline/timeline.service';
import { anonymizeIp } from '../common/utils/anonymize-ip.util';
import {
  AUDIT_LOG_KEY,
  AuditLogMetadata,
} from './decorators/audit-log.decorator';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditLogInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly timelineService: TimelineService,
  ) {}

  // Return type and tap import use `any`/require to avoid rxjs version mismatch
  // between apps/backend/node_modules and root node_modules.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  intercept(context: ExecutionContext, next: CallHandler): any {
    const metadata = this.reflector.get<AuditLogMetadata>(
      AUDIT_LOG_KEY,
      context.getHandler(),
    );

    if (!metadata) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const { method, url, user, body } = request;
    const userId: string = user?.id ?? 'anonymous';
    const ip = anonymizeIp(
      request.ip || request.connection?.remoteAddress,
    );
    const now = Date.now();

    // Use require() to avoid rxjs version mismatch between
    // apps/backend/node_modules and root node_modules.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { tap } = require('rxjs/operators');

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
    return (next.handle() as any).pipe(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tap(async (_response: any) => {
        const elapsed = Date.now() - now;

        try {
          await this.timelineService.logAction({
            entityId: userId,
            electionId: body?.electionId ?? 'system',
            action: metadata.action,
            metadata: {
              method,
              url,
              userId,
              ip,
              entityType: metadata.entityType,
              ...(metadata.getMetadata
                ? { getMetadata: metadata.getMetadata(_response, request) }
                : {}),
              elapsed,
            },
          });
        } catch (error: unknown) {
          const message =
            error instanceof Error ? error.message : String(error);
          this.logger.error(`Failed to write audit log: ${message}`);
        }

        this.logger.log(
          `GDPR audit: ${metadata.action} by=${userId} ${method} ${url} ${elapsed}ms`,
        );
      }),
    );
  }
}
