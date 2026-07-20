import { Controller, Get, Query } from '@nestjs/common';
import { Auth } from 'src/auth/decorators';
import { AuditService } from './audit.service';

@Controller('audit')
@Auth()
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('summary')
  getSummary(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('module') module?: string,
    @Query('severity') severity?: string,
    @Query('user') user?: string,
    @Query('query') query?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ): Promise<unknown> {
    return this.auditService.getSummary({
      page,
      pageSize,
      module,
      severity,
      user,
      query,
      dateFrom,
      dateTo,
    });
  }
}
