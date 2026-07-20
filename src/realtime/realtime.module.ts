import { Module } from '@nestjs/common';
import { RealtimeGateway } from '@org/realtime';

@Module({
  providers: [RealtimeGateway],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}
