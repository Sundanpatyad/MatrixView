import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

export const PHASE_STATUSES = ['planned', 'active', 'done'] as const;
export type PhaseStatus = (typeof PHASE_STATUSES)[number];

const phaseSchema = new Schema(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    name: { type: String, required: true, trim: true },
    order: { type: Number, default: 0 },
    status: { type: String, enum: PHASE_STATUSES, default: 'planned' },
    /** Calendar day YYYY-MM-DD */
    startDate: { type: String, default: '' },
    endDate: { type: String, default: '' },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

phaseSchema.index({ projectId: 1, order: 1 });

export type PhaseDoc = HydratedDocument<
  InferSchemaType<typeof phaseSchema> & {
    createdAt: Date;
    updatedAt: Date;
  }
>;

export const Phase = model('ProjectPhase', phaseSchema);
