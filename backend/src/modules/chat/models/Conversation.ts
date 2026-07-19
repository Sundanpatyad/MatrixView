import { Schema, model, type HydratedDocument, type InferSchemaType, Types } from 'mongoose';

const conversationSchema = new Schema(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    type: { type: String, enum: ['dm', 'group'], required: true },
    name: { type: String, default: '', trim: true },
    avatarUrl: { type: String, default: null },
    memberIds: [{ type: Schema.Types.ObjectId, ref: 'User', required: true }],
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    lastMessageAt: { type: Date, default: Date.now },
    lastMessagePreview: { type: String, default: '' },
  },
  { timestamps: true },
);

conversationSchema.index({ orgId: 1, memberIds: 1 });
conversationSchema.index({ orgId: 1, lastMessageAt: -1 });

export type ConversationDoc = HydratedDocument<
  InferSchemaType<typeof conversationSchema> & {
    createdAt: Date;
    updatedAt: Date;
  }
>;

export const Conversation = model('Conversation', conversationSchema);
