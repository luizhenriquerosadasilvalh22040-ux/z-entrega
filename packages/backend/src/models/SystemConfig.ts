import { Schema, model, Document } from 'mongoose';

export interface ISystemConfigDocument extends Document {
  defaultSubscriptionPrice: number;
  createdAt: Date;
  updatedAt: Date;
}

const SystemConfigSchema = new Schema<ISystemConfigDocument>({
  defaultSubscriptionPrice: { type: Number, required: true, default: 150.00 }
}, {
  timestamps: true
});

export const SystemConfig = model<ISystemConfigDocument>('SystemConfig', SystemConfigSchema);
