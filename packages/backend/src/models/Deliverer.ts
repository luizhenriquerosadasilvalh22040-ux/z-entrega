import { Schema, model, Document } from 'mongoose';

export interface IDelivererDocument extends Document {
  name: string;
  phone: string;
  email: string;
  passwordHash: string;
  vehicle: 'Moto' | 'Bicicleta' | 'Carro';
  plate?: string;
  isActive: boolean;
  isAvailable: boolean;
  isActiveToday: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const DelivererSchema = new Schema<IDelivererDocument>({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String, required: true, unique: true, index: true },
  passwordHash: { type: String, required: true },
  vehicle: { type: String, required: true, enum: ['Moto', 'Bicicleta', 'Carro'], default: 'Moto' },
  plate: { type: String },
  isActive: { type: Boolean, default: true },
  isAvailable: { type: Boolean, default: false },
  isActiveToday: { type: Boolean, default: false }
}, {
  timestamps: true
});

export const Deliverer = model<IDelivererDocument>('Deliverer', DelivererSchema);
