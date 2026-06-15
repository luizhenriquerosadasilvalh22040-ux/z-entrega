import { Schema, model, Document } from 'mongoose';
import { IAddress } from '../types';

export interface ICustomerDocument extends Document {
  name: string;
  email: string;
  passwordHash: string;
  cpf: string; // Salvo encriptado
  phone: string;
  address: IAddress;
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

const CustomerSchema = new Schema<ICustomerDocument>({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, index: true },
  passwordHash: { type: String, required: true },
  cpf: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  address: { type: AddressSchema, required: true },
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true
});

export const Customer = model<ICustomerDocument>('Customer', CustomerSchema);
