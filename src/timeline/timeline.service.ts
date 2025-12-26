import { TimelineSchema } from './timeline.schema';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Injectable()
export class TimelineService {
  constructor(
    @InjectModel('timeline') private readonly timelineModel: Model<any>,
  ) {}

  async logAction(data: {
    entityId: string;
    electionId: string;
    action: string;
    metadata?: Record<string, any>;
  }) {
    const record = new this.timelineModel(data);
    return await record.save();
  }

  async getTimelineBy(entityId: string) {
    return this.timelineModel.find({ entityId: entityId}).sort({ createdAt: -1 }).exec();
  }
}
