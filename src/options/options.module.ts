import { TenantsModule } from 'src/tenants/user-settings.module';
import { Module } from '@nestjs/common';
import { OptionsService } from './options.service';
import { OptionsController } from './options.controller';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from 'src/auth/auth.module';
import { Options } from './entities/option.entity';

@Module({
  controllers: [OptionsController],
  imports: [AuthModule, TenantsModule,TypeOrmModule.forFeature([Options]), AuthModule],
  providers: [OptionsService],
  exports: [OptionsService, TypeOrmModule],
})
export class OptionsModule {}
