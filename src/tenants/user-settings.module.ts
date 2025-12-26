import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantsService } from './users-settings.service';
import { TenantsController } from './users-settings.controller';
import { UserSettings } from './entities/user-settings.entity';
import { RequestContextModule } from 'nestjs-request-context/dist/request-context.module';

@Module({
  controllers: [TenantsController],
  imports: [RequestContextModule, TypeOrmModule.forFeature([UserSettings])],
  providers: [TenantsService],
  exports: [TenantsService],
})
export class TenantsModule {}
