import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

const activityDaySummarySchema = new Schema(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    /** Calendar day YYYY-MM-DD in the client's timezone. */
    date: { type: String, required: true },
    tzOffsetMinutes: { type: Number, default: 0 },
    attendanceStatus: {
      type: String,
      enum: ['checked_in', 'checked_out', 'not_in'],
      required: true,
    },
    firstCheckInAt: { type: Date, default: null },
    lastCheckOutAt: { type: Date, default: null },
    totalClockedMs: { type: Number, default: 0 },
    totalTrackedMs: { type: Number, default: 0 },
    sessionCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

activityDaySummarySchema.index({ userId: 1, date: 1 }, { unique: true });
activityDaySummarySchema.index({ orgId: 1, date: 1 });

export type ActivityDaySummaryDoc = HydratedDocument<
  InferSchemaType<typeof activityDaySummarySchema> & {
    createdAt: Date;
    updatedAt: Date;
  }
>;

export const ActivityDaySummary = model('ActivityDaySummary', activityDaySummarySchema);
