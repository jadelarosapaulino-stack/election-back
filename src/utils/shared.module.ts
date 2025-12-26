import { Module } from '@nestjs/common';
import { LoggerService } from './logs/logger.service';
import { TimelineService } from 'src/timeline/timeline.service';

@Module({
  imports: [], // 👈 no necesita importar nada
  providers: [LoggerService],
  exports: [LoggerService], // 👈 esto permite que otros lo usen
})
export class SharedModule {}
