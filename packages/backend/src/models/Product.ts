import { Schema, model, Document, Types } from 'mongoose';

export interface IProductDocument extends Document {
  merchantId: Types.ObjectId;
  name: string;
  description: string;
  price: number;
  category: string;
  image?: string;
  isAvailable: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema<IProductDocument>({
  merchantId: { type: Schema.Types.ObjectId, ref: 'Merchant', required: true, index: true },
  name: { type: String, required: true, index: true },
  description: { type: String, required: true },
  price: { type: Number, required: true },
  category: { type: String, required: true, index: true },
  image: { type: String },
  isAvailable: { type: Boolean, default: true }
}, {
  timestamps: true
});

// Índice de busca textual para produtos
ProductSchema.index({ name: 'text', description: 'text' });

export const Product = model<IProductDocument>('Product', ProductSchema);
