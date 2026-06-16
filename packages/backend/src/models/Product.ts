import { Schema, model, Document, Types } from 'mongoose';

export interface IOption {
  name: string;
  price: number;
}

export interface IOptionGroup {
  name: string;
  required: boolean;
  minSelect: number;
  maxSelect: number;
  options: IOption[];
}

export interface IProductDocument extends Document {
  merchantId: Types.ObjectId;
  name: string;
  description: string;
  price: number;
  category: string;
  image?: string;
  isAvailable: boolean;
  stockQuantity: number;
  isPaused: boolean;
  optionGroups: IOptionGroup[];
  createdAt: Date;
  updatedAt: Date;
}

const OptionSchema = new Schema<IOption>({
  name: { type: String, required: true },
  price: { type: Number, required: true, default: 0 }
}, { _id: false });

const OptionGroupSchema = new Schema<IOptionGroup>({
  name: { type: String, required: true },
  required: { type: Boolean, default: false },
  minSelect: { type: Number, default: 0 },
  maxSelect: { type: Number, default: 1 },
  options: { type: [OptionSchema], default: [] }
}, { _id: false });

const ProductSchema = new Schema<IProductDocument>({
  merchantId: { type: Schema.Types.ObjectId, ref: 'Merchant', required: true, index: true },
  name: { type: String, required: true, index: true },
  description: { type: String, required: true },
  price: { type: Number, required: true },
  category: { type: String, required: true, index: true },
  image: { type: String },
  isAvailable: { type: Boolean, default: true },
  stockQuantity: { type: Number, default: 99 }, // Estoque padrão inicial alto
  isPaused: { type: Boolean, default: false },
  optionGroups: { type: [OptionGroupSchema], default: [] }
}, {
  timestamps: true
});

// Índice de busca textual para produtos
ProductSchema.index({ name: 'text', description: 'text' });

export const Product = model<IProductDocument>('Product', ProductSchema);
