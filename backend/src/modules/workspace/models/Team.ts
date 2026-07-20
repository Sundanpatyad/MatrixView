import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

const teamSchema = new Schema(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    name: { type: String, required: true, trim: true },
    /** Project member ids (`Project.members[].id`) */
    memberIds: { type: [String], default: [] },
  },
  { timestamps: true },
);

teamSchema.index({ projectId: 1, name: 1 }, { unique: true });

export type TeamDoc = HydratedDocument<
  InferSchemaType<typeof teamSchema> & {
    createdAt: Date;
    updatedAt: Date;
  }
>;

export const Team = model('Team', teamSchema);
