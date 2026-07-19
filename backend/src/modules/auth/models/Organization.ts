import { Schema, model, type InferSchemaType, Types } from 'mongoose';

const organizationSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  },
  { timestamps: true },
);

export type OrganizationDoc = InferSchemaType<typeof organizationSchema> & {
  _id: Types.ObjectId;
};

export const Organization = model('Organization', organizationSchema);
