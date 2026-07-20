import { Module } from '@nestjs/common';
import { EmailService } from './email/email.service';
import { EmailQueueModule } from './email/email-queue.module';
import { SystemConfigModule } from '../system-config/system-config.module';

@Module({
  imports: [EmailQueueModule, SystemConfigModule],
  providers: [EmailService],
  exports: [EmailService],
})
export class CommonModule {}
