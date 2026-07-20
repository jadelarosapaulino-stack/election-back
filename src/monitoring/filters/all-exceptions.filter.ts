import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { MonitoringService } from '../monitoring.service';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly monitoring: MonitoringService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = exception instanceof HttpException
      ? exception.getResponse()
      : { message: 'Internal server error' };

    this.logger.error(`${request.method} ${request.url} ${status}`, exception instanceof Error ? exception.stack : '');

    this.monitoring.logError({
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
    }).catch(() => {});

    response.status(status).json(message);
  }
}
