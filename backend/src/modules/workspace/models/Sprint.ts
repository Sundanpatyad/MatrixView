import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

export const SPRINT_STATUSES = ['planned', 'active', 'done'] as const;
export type SprintStatus = (typeof SPRINT_STATUSES)[number];

const columnSchema = new Schema(
  {
    id: { type: String, required: true },
    label: { type: String, required: true },
    accent: { type: String, required: true },
    locked: { type: Boolean, default: false },
  },
  { _id: false },
);

const sprintSchema = new Schema(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    phaseId: { type: Schema.Types.ObjectId, ref: 'ProjectPhase', default: null, index: true },
    name: { type: String, required: true, trim: true },
    status: { type: String, enum: SPRINT_STATUSES, default: 'planned' },
    /** Calendar day YYYY-MM-DD */
    startDate: { type: String, required: true },
    endDate: { type: String, required: true },
    columns: { type: [columnSchema], default: [] },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

sprintSchema.index({ projectId: 1, startDate: 1 });

export type SprintDoc = HydratedDocument<
  InferSchemaType<typeof sprintSchema> & {
    createdAt: Date;
    updatedAt: Date;
  }
>;

export const Sprint = model('ProjectSprint', sprintSchema);
