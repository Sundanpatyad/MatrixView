import { Schema, model, type InferSchemaType, Types } from 'mongoose';

const sessionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    deviceType: {
      type: String,
      enum: ['web', 'desktop', 'mobile'],
      required: true,
    },
    deviceId: { type: String, default: null },
    refreshTokenHash: { type: String, required: true, index: true },
    familyId: { type: String, required: true, index: true },
    ip: { type: String, default: null },
    userAgent: { type: String, default: null },
    lastActiveAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true, index: true },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export type SessionDoc = InferSchemaType<typeof sessionSchema> & {
  _id: Types.ObjectId;
};

export const Session = model('Session', sessionSchema);
