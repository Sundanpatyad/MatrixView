import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

const attachmentSchema = new Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    size: { type: Number, required: true },
    mimeType: { type: String, required: true },
    url: { type: String, required: true },
    kind: { type: String, enum: ['image', 'video', 'document', 'other'], default: 'other' },
  },
  { _id: false },
);

const receiptSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    deliveredAt: { type: Date, default: null },
    readAt: { type: Date, default: null },
  },
  { _id: false },
);

const messageSchema = new Schema(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, default: '' },
    replyToId: { type: Schema.Types.ObjectId, ref: 'Message', default: null },
    attachments: { type: [attachmentSchema], default: [] },
    receipts: { type: [receiptSchema], default: [] },
    editedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

messageSchema.index({ conversationId: 1, createdAt: -1 });

export type MessageDoc = HydratedDocument<
  InferSchemaType<typeof messageSchema> & {
    createdAt: Date;
    updatedAt: Date;
  }
>;

export const Message = model('Message', messageSchema);
