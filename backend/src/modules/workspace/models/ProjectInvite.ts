import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

const projectInviteSchema = new Schema(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    name: { type: String, default: '' },
    role: { type: String, enum: ['admin', 'member'], default: 'member' },
    tokenHash: { type: String, required: true, unique: true },
    invitedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'revoked'],
      default: 'pending',
      index: true,
    },
    expiresAt: { type: Date, required: true },
    acceptedAt: { type: Date, default: null },
    acceptedUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

projectInviteSchema.index({ orgId: 1, projectId: 1, email: 1, status: 1 });

export type ProjectInviteDoc = HydratedDocument<
  InferSchemaType<typeof projectInviteSchema> & {
    createdAt: Date;
    updatedAt: Date;
  }
>;

export const ProjectInvite = model('ProjectInvite', projectInviteSchema);
