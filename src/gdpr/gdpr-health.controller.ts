import { Controller, Get } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BreachEvent } from './breach-event.entity';
import { ProcessingRecord } from './processing-record.entity';
import { DpiaRecord } from './dpia-record.entity';
import { DpaRecord } from './dpa-record.entity';

/**
 * Endpoint de salud del módulo GDPR.
 * Sin autenticación — diseñado para monitoreo y health checks.
 * Expone conteos de registros y breaches pendientes.
 */
@Controller('gdpr/health')
export class GdprHealthController {
  constructor(
    @InjectRepository(BreachEvent)
    private readonly breachRepo: Repository<BreachEvent>,
    @InjectRepository(ProcessingRecord)
    private readonly processingRepo: Repository<ProcessingRecord>,
    @InjectRepository(DpiaRecord)
    private readonly dpiaRepo: Repository<DpiaRecord>,
    @InjectRepository(DpaRecord)
    private readonly dpaRepo: Repository<DpaRecord>,
  ) {}

  @Get()
  async check() {
    const [breachCount, processingCount, dpiaCount, dpaCount] =
      await Promise.all([
        this.breachRepo.count(),
        this.processingRepo.count(),
        this.dpiaRepo.count(),
        this.dpaRepo.count(),
      ]);

    const pendingBreaches = await this.breachRepo.count({
      where: { status: 'detected' },
    });

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      components: {
        breachEvents: { count: breachCount, pending: pendingBreaches },
        processingRecords: { count: processingCount },
        dpiaRecords: { count: dpiaCount },
        dpaRecords: { count: dpaCount },
      },
    };
  }
}
