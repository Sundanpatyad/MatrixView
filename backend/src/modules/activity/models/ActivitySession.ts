import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

const appUsageSchema = new Schema(
  {
    appName: { type: String, required: true },
    processName: { type: String, default: '' },
    durationMs: { type: Number, default: 0 },
    lastWindowTitle: { type: String, default: '' },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const siteUsageSchema = new Schema(
  {
    host: { type: String, required: true },
    url: { type: String, default: '' },
    title: { type: String, default: '' },
    browserName: { type: String, default: '' },
    durationMs: { type: Number, default: 0 },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const awayPeriodSchema = new Schema(
  {
    kind: {
      type: String,
      enum: ['locked', 'sleep', 'lid_closed', 'away'],
      required: true,
    },
    startedAt: { type: Date, required: true },
    endedAt: { type: Date, required: true },
    durationMs: { type: Number, required: true },
  },
  { _id: false },
);

const activitySessionSchema = new Schema(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: {
      type: String,
      enum: ['active', 'closed'],
      default: 'active',
      required: true,
    },
    startedAt: { type: Date, required: true, default: Date.now },
    endedAt: { type: Date, default: null },
    apps: { type: [appUsageSchema], default: [] },
    sites: { type: [siteUsageSchema], default: [] },
    awayPeriods: { type: [awayPeriodSchema], default: [] },
  },
  { timestamps: true },
);

activitySessionSchema.index({ userId: 1, status: 1 });
activitySessionSchema.index({ orgId: 1, startedAt: -1 });

export type ActivitySessionDoc = HydratedDocument<
  InferSchemaType<typeof activitySessionSchema> & {
    createdAt: Date;
    updatedAt: Date;
  }
>;

export const ActivitySession = model('ActivitySession', activitySessionSchema);
