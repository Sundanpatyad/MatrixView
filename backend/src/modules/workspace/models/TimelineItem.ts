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

const timelineSchema = new Schema(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
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
    dueDate: { type: String, default: '' },
    /** Optional project team — null = project-wide backlog item */
    teamId: { type: Schema.Types.ObjectId, ref: 'Team', default: null, index: true },
    attachments: { type: [attachmentSchema], default: [] },
    createdBy: { type: String, required: true },
    createdByName: { type: String, required: true },
    assigneeId: { type: String, default: null },
    assigneeName: { type: String, default: null },
    taskId: { type: Schema.Types.ObjectId, ref: 'Task', default: null },
    assignedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export type TimelineDoc = HydratedDocument<
  InferSchemaType<typeof timelineSchema> & {
    createdAt: Date;
    updatedAt: Date;
  }
>;

export const TimelineItem = model('TimelineItem', timelineSchema);
