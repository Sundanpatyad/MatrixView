import { Schema, model, type HydratedDocument, type InferSchemaType, Types } from 'mongoose';

const columnSchema = new Schema(
  {
    id: { type: String, required: true },
    label: { type: String, required: true },
    accent: { type: String, required: true },
    locked: { type: Boolean, default: false },
  },
  { _id: false },
);

const memberSchema = new Schema(
  {
    id: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    name: { type: String, required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    role: { type: String, enum: ['admin', 'member'], required: true },
    /** active = can use project; pending = invited by email, waiting for signup */
    status: { type: String, enum: ['active', 'pending'], default: 'active' },
    addedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const projectSchema = new Schema(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true, trim: true },
    key: { type: String, required: true, uppercase: true, trim: true },
    description: { type: String, default: '' },
    createdBy: { type: String, required: true },
    createdByUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    columns: { type: [columnSchema], default: [] },
    members: { type: [memberSchema], default: [] },
    taskSeq: { type: Number, default: 0 },
  },
  { timestamps: true },
);

projectSchema.index({ orgId: 1, key: 1 }, { unique: true });

export type ProjectDoc = HydratedDocument<
  InferSchemaType<typeof projectSchema> & {
    createdAt: Date;
    updatedAt: Date;
  }
>;

export const Project = model('Project', projectSchema);
