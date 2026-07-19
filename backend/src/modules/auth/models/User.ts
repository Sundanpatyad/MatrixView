import { Schema, model, type InferSchemaType, Types } from 'mongoose';

const userSchema = new Schema(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, default: '', trim: true },
    avatarUrl: { type: String, default: null },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ['Admin', 'Manager', 'Member'],
      default: 'Member',
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'invited', 'disabled', 'locked'],
      default: 'active',
      required: true,
    },
    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },
  },
  { timestamps: true },
);

userSchema.index({ orgId: 1, email: 1 }, { unique: true });
userSchema.index({ email: 1 });

export type UserDoc = InferSchemaType<typeof userSchema> & {
  _id: Types.ObjectId;
};

export const User = model('User', userSchema);
