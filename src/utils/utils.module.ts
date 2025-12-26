import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from 'src/auth/auth.module';
import { StatusController } from './status/status.controller';
import { StatusService } from './status/status.service';
import { Status } from './status/entities/status.entity';

@Module({
  controllers: [StatusController],
  imports: [TypeOrmModule.forFeature([Status]), AuthModule],
  providers: [StatusService],
})

export class UtilsModule {}
