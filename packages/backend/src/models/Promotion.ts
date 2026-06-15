import { Schema, model, Document, Types } from 'mongoose';

export interface IPromotionDocument extends Document {
  merchantId: Types.ObjectId;
  name: string;
  discountPercentage: number;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  targetProducts: Types.ObjectId[]; // IDs de produtos afetados (se vazio, afeta toda a loja)
  createdAt: Date;
  updatedAt: Date;
}

const PromotionSchema = new Schema<IPromotionDocument>({
  merchantId: { type: Schema.Types.ObjectId, ref: 'Merchant', required: true, index: true },
  name: { type: String, required: true },
  discountPercentage: { type: Number, required: true, min: 0, max: 100 },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  isActive: { type: Boolean, default: true },
  targetProducts: [{ type: Schema.Types.ObjectId, ref: 'Product' }]
}, {
  timestamps: true
});

export const Promotion = model<IPromotionDocument>('Promotion', PromotionSchema);
