import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { I18nExceptionFilter } from '../../common/i18n/i18n-exception.filter';
import { MonitoringService } from '../monitoring.service';

@Catch()
export class MonitoringExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly monitoring: MonitoringService,
    private readonly i18nFilter: I18nExceptionFilter,
  ) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // Log the error to monitoring (fire-and-forget)
    this.monitoring
      .logError({
        severity: status >= 500 ? 'error' : 'warn',
        service: 'API Backend',
        message: exception instanceof Error ? exception.message : String(exception),
        stackTrace: exception instanceof Error ? exception.stack : undefined,
        context: {
          method: request.method,
          path: request.url,
          statusCode: status,
          ip: request.ip,
        },
      })
      .catch(() => {
        // Swallow — monitoring persistence failure must not break the response
      });

    // Delegate to i18n filter for response formatting
    this.i18nFilter.catch(exception, host);
  }
}
