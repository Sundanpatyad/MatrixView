import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

/** One-way user block. The blocker no longer sees or can message the other person in DMs. */
const userBlockSchema = new Schema(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    blockedUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  },
  { timestamps: true },
);

userBlockSchema.index({ userId: 1, blockedUserId: 1 }, { unique: true });

export type UserBlockDoc = HydratedDocument<
  InferSchemaType<typeof userBlockSchema> & {
    createdAt: Date;
    updatedAt: Date;
  }
>;

export const UserBlock = model('UserBlock', userBlockSchema);
