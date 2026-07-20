import { Schema } from 'mongoose';
import { TimelineAction } from './timeline.enum';

export const TimelineSchema = new Schema(
  {
    entityId: { type: String, required: true },
    electionId: { type: String, required: true },
    action: {
      type: String,
      enum: Object.values(TimelineAction),
      required: true,
    },
    metadata: { type: Object }, // opcional: para guardar IP, navegador, etc.
  },
  { timestamps: true }, // crea createdAt y updatedAt
);

// H-21: TTL index — auto-expire audit/timeline documents after 90 days
TimelineSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });
TimelineSchema.index({ electionId: 1, createdAt: -1 });
TimelineSchema.index({ electionId: 1, action: 1, 'metadata.deviceId': 1, createdAt: -1 });

// export interface Timeline {
//   voterId: string;
//   electionId: string;
//   action: 'entered' | 'voted' | 'logout' | 'viewed_results';
//   metadata?: Record<string, any>; // opcional
//   createdAt?: Date;
//   updatedAt?: Date;
// }
