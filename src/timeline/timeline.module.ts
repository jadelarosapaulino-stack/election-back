import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TimelineSchema } from './timeline.schema';
import { TimelineService } from './timeline.service';


@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'timeline', schema: TimelineSchema },
    ]),
  ],
  providers: [TimelineService],
  exports: [TimelineService],
})
export class TimelineModule {}
