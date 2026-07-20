import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { TimelineSchema } from 'src/timeline/timeline.schema';
import { AuthModule } from 'src/auth/auth.module';
import { Aes256GcmService } from 'src/common/security/aes-256-gcm.service';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([{ name: 'timeline', schema: TimelineSchema }]),
  ],
  controllers: [AuditController],
  providers: [AuditService, Aes256GcmService],
})
export class AuditModule {}
