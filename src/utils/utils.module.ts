import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from 'src/auth/auth.module';
import { StatusController } from './status/status.controller';
import { StatusService } from './status/status.service';
import { Status } from './status/entities/status.entity';
import { SecurityController } from './security/security.controller';
import { Aes256GcmService } from 'src/common/security/aes-256-gcm.service';

@Module({
  controllers: [StatusController, SecurityController],
  imports: [TypeOrmModule.forFeature([Status]), AuthModule],
  providers: [StatusService, Aes256GcmService],
})

export class UtilsModule {}
