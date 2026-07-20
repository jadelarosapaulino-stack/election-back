import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SystemHealthCheck } from './entities/system-health-check.entity';
import { ApiRequestLog } from './entities/api-request-log.entity';
import { ServiceStatus } from './entities/service-status.entity';
import { ErrorLog } from './entities/error-log.entity';
import { MonitoringService } from './monitoring.service';
import { MonitoringController } from './monitoring.controller';
import { Aes256GcmService } from '../common/security/aes-256-gcm.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([SystemHealthCheck, ApiRequestLog, ServiceStatus, ErrorLog]),
  ],
  controllers: [MonitoringController],
  providers: [MonitoringService, Aes256GcmService],
  exports: [MonitoringService],
})
export class MonitoringModule {}
