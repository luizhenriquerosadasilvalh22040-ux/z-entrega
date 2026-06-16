import { Schema, model, Document } from 'mongoose';
import { IAddress, ISavedAddress } from '../types';

export interface ICustomerDocument extends Document {
  name: string;
  email?: string;
  passwordHash?: string;
  cpf?: string; // Salvo encriptado
  phone: string;
  address: IAddress;
  savedAddresses: ISavedAddress[];
  isPhoneVerified: boolean;
  verificationCode?: string;
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
  complement: { type: String },
  referencePoint: { type: String },
  coordinates: {
    lat: { type: Number },
    lng: { type: Number }
  }
}, { _id: false });

const CustomerSchema = new Schema<ICustomerDocument>({
  name: { type: String, required: true },
  email: { type: String, unique: true, index: true, sparse: true },
  passwordHash: { type: String },
  cpf: { type: String, unique: true, sparse: true },
  phone: { type: String, required: true, unique: true, index: true },
  address: { type: AddressSchema, required: true },
  savedAddresses: { type: [new Schema<ISavedAddress>({
    nickname: { type: String, required: true },
    street: { type: String, required: true },
    number: { type: String, required: true },
    neighborhood: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    zipCode: { type: String, required: true },
    complement: { type: String },
    referencePoint: { type: String },
    coordinates: {
      lat: { type: Number },
      lng: { type: Number }
    }
  }, { _id: false })], default: [] },
  isPhoneVerified: { type: Boolean, default: false },
  verificationCode: { type: String },
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true
});

export const Customer = model<ICustomerDocument>('Customer', CustomerSchema);
