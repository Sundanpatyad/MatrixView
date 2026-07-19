import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

const attachmentSchema = new Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    size: { type: Number, required: true },
    mimeType: { type: String, required: true },
    url: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    uploadedBy: { type: String, required: true },
    storageProvider: { type: String, default: null },
    storageKey: { type: String, default: null },
  },
  { _id: false },
);

const commentSchema = new Schema(
  {
    id: { type: String, required: true },
    authorId: { type: String, default: '' },
    authorName: { type: String, required: true },
    body: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
    attachments: { type: [attachmentSchema], default: [] },
  },
  { _id: false },
);

const taskSchema = new Schema(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    key: { type: String, required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    type: {
      type: String,
      enum: ['task', 'bug', 'story', 'time'],
      default: 'task',
    },
    priority: {
      type: String,
      enum: ['lowest', 'low', 'medium', 'high', 'highest'],
      default: 'medium',
    },
    status: { type: String, required: true },
    estimateHours: { type: Number, default: 0 },
    loggedHours: { type: Number, default: 0 },
    remainingHours: { type: Number, default: 0 },
    createdBy: { type: String, required: true },
    createdByName: { type: String, required: true },
    assigneeId: { type: String, default: '' },
    assigneeName: { type: String, default: '' },
    reporterName: { type: String, default: '' },
    labels: { type: [String], default: [] },
    startDate: { type: String, default: '' },
    endDate: { type: String, default: '' },
    dueDate: { type: String, default: '' },
    comments: { type: [commentSchema], default: [] },
    attachments: { type: [attachmentSchema], default: [] },
  },
  { timestamps: true },
);

taskSchema.index({ orgId: 1, projectId: 1 });
taskSchema.index({ projectId: 1, key: 1 }, { unique: true });

export type TaskDoc = HydratedDocument<
  InferSchemaType<typeof taskSchema> & {
    createdAt: Date;
    updatedAt: Date;
  }
>;

export const Task = model('Task', taskSchema);
