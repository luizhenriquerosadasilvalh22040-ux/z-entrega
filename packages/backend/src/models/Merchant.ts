import { Schema, model, Document } from 'mongoose';
import { IAddress, IOperatingHours } from '../types';

export interface IMerchantDocument extends Document {
  name: string;
  email: string;
  passwordHash: string;
  cnpj: string; // Salvo encriptado
  phone: string;
  category: 'Comida' | 'Farmácia' | 'Construção' | 'Geral';
  operatingHours: IOperatingHours;
  paymentMethods: string[];
  address: IAddress;
  isVerified: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AddressSchema = new Schema<IAddress>({
  street: { type: String, required: true },
  number: { type: String, required: true },
  neighborhood: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  zipCode: { type: String, required: true },
  coordinates: {
    lat: { type: Number },
    lng: { type: Number }
  }
}, { _id: false });

const OperatingHoursSchema = new Schema<IOperatingHours>({
  open: { type: String, required: true, default: "08:00" },
  close: { type: String, required: true, default: "22:00" }
}, { _id: false });

const MerchantSchema = new Schema<IMerchantDocument>({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, index: true },
  passwordHash: { type: String, required: true },
  cnpj: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  category: { 
    type: String, 
    required: true, 
    enum: ['Comida', 'Farmácia', 'Construção', 'Geral'],
    index: true
  },
  operatingHours: { type: OperatingHoursSchema, required: true },
  paymentMethods: [{ type: String, required: true }],
  address: { type: AddressSchema, required: true },
  isVerified: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true
});

export const Merchant = model<IMerchantDocument>('Merchant', MerchantSchema);
