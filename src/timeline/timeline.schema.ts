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

// export interface Timeline {
//   voterId: string;
//   electionId: string;
//   action: 'entered' | 'voted' | 'logout' | 'viewed_results';
//   metadata?: Record<string, any>; // opcional
//   createdAt?: Date;
//   updatedAt?: Date;
// }
