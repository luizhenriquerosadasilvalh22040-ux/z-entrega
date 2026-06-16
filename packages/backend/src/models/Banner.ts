import { Schema, model, Document } from 'mongoose';

export interface IBannerDocument extends Document {
  imageUrl: string;
  title?: string;
  linkUrl?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const BannerSchema = new Schema<IBannerDocument>({
  imageUrl: { type: String, required: true },
  title: { type: String },
  linkUrl: { type: String },
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true
});

export const Banner = model<IBannerDocument>('Banner', BannerSchema);
