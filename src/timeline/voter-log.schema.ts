import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class VoterLog extends Document {
  @Prop({ required: true })
  voterId: string;

  @Prop({ required: true })
  voteDate: Date;

  @Prop({ required: true })
  candidateId: string;

  @Prop({ default: null })
  ipAddress: string;

  @Prop({ default: 'pending' })
  status: string; // "pending", "completed", "failed", etc.
}

export const VoterLogSchema = SchemaFactory.createForClass(VoterLog);
