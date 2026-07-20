import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { PaymentsAdminController } from './payments-admin.controller';
import { PaymentsAdminService } from './payments-admin.service';

@Module({
  imports: [AuthModule, ConfigModule],
  controllers: [PaymentsAdminController],
  providers: [PaymentsAdminService],
})
export class PaymentsAdminModule {}
