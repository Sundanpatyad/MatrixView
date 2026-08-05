import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

/**
 * Per-user chat preferences and soft-delete state.
 * Keep membership on Conversation.memberIds; use this for mute/pin/hide/clear.
 */
const conversationMemberStateSchema = new Schema(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    muted: { type: Boolean, default: false },
    pinned: { type: Boolean, default: false },
    pinnedAt: { type: Date, default: null },
    /** Hide messages at or before this time from this user. */
    clearedAt: { type: Date, default: null },
    /** Hide the conversation from this user's list until a newer message arrives. */
    hiddenAt: { type: Date, default: null },
  },
  { timestamps: true },
);

conversationMemberStateSchema.index({ conversationId: 1, userId: 1 }, { unique: true });
conversationMemberStateSchema.index({ userId: 1, pinned: 1, pinnedAt: -1 });

export type ConversationMemberStateDoc = HydratedDocument<
  InferSchemaType<typeof conversationMemberStateSchema> & {
    createdAt: Date;
    updatedAt: Date;
  }
>;

export const ConversationMemberState = model(
  'ConversationMemberState',
  conversationMemberStateSchema,
);
