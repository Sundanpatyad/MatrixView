import { Schema, model, type InferSchemaType, Types } from 'mongoose';

export const DEVICE_PLATFORMS = ['android', 'ios'] as const;
export type DevicePlatform = (typeof DEVICE_PLATFORMS)[number];

const deviceTokenSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    token: { type: String, required: true, trim: true },
    platform: { type: String, enum: DEVICE_PLATFORMS, required: true },
    deviceId: { type: String, default: null, trim: true },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

deviceTokenSchema.index({ token: 1 }, { unique: true });
deviceTokenSchema.index({ userId: 1, platform: 1 });

export type DeviceTokenDoc = InferSchemaType<typeof deviceTokenSchema> & {
  _id: Types.ObjectId;
};

export const DeviceToken = model('DeviceToken', deviceTokenSchema);
