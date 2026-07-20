import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { MonitoringService } from './monitoring.service';
import { InternalApiKeyGuard } from './guards/internal-api-key.guard';

@UseGuards(InternalApiKeyGuard)
@Controller('monitoring')
export class MonitoringController {
  constructor(private readonly monitoringService: MonitoringService) {}

  @Get('health')
  async health() {
    return this.monitoringService.runHealthChecks();
  }

  @Get('health/ready')
  async ready() {
    const result = await this.monitoringService.runHealthChecks();
    return { status: result.status === 'down' ? 503 : 200, ready: result.status !== 'down' };
  }

  @Get('metrics')
  async metrics() {
    return this.monitoringService.getMetrics();
  }

  @Get('services')
  async services() {
    return this.monitoringService.getServiceStatuses();
  }

  @Get('logs')
  async logs(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const p = Math.max(1, Number(page) || 1);
    const ps = Math.min(100, Math.max(1, Number(pageSize) || 50));
    return this.monitoringService.getRequestLogs(p, ps);
  }

  @Get('errors')
  async errors(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('severity') severity?: string,
  ) {
    const p = Math.max(1, Number(page) || 1);
    const ps = Math.min(100, Math.max(1, Number(pageSize) || 50));
    return this.monitoringService.getErrorLogs(p, ps, severity || undefined);
  }
}
