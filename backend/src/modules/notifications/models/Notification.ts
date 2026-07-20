import { Schema, model, type HydratedDocument, type InferSchemaType, Types } from 'mongoose';

export const NOTIFICATION_TYPES = [
  'message',
  'task_assigned',
  'project_invite',
  'task_comment',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

const metaSchema = new Schema(
  {
    projectId: { type: String, default: null },
    taskId: { type: String, default: null },
    taskKey: { type: String, default: null },
    conversationId: { type: String, default: null },
    messageId: { type: String, default: null },
    commentId: { type: String, default: null },
    href: { type: String, default: null },
  },
  { _id: false },
);

const notificationSchema = new Schema(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    recipientId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    actorId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    actorName: { type: String, default: '' },
    type: {
      type: String,
      enum: NOTIFICATION_TYPES,
      required: true,
    },
    title: { type: String, required: true, trim: true },
    body: { type: String, default: '' },
    readAt: { type: Date, default: null },
    meta: { type: metaSchema, default: () => ({}) },
  },
  { timestamps: true },
);

notificationSchema.index({ recipientId: 1, createdAt: -1 });
notificationSchema.index({ recipientId: 1, readAt: 1 });

export type NotificationDoc = HydratedDocument<
  InferSchemaType<typeof notificationSchema> & {
    createdAt: Date;
    updatedAt: Date;
  }
>;

export type NotificationLean = InferSchemaType<typeof notificationSchema> & {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const Notification = model('Notification', notificationSchema);
