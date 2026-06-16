import { Schema, model, Document, Types } from 'mongoose';
import { IAddress } from '../types';

export type OrderStatus = 
  | 'PENDING' 
  | 'ACCEPTED' 
  | 'PREPARING' 
  | 'READY' 
  | 'DISPATCHED' 
  | 'IN_TRANSIT' 
  | 'DELIVERED' 
  | 'CANCELLED';

export interface IChosenOption {
  groupName: string;
  optionName: string;
  price: number;
}

export interface IOrderItem {
  productId: Types.ObjectId;
  name: string;
  price: number;
  quantity: number;
  chosenOptions?: IChosenOption[];
  notes?: string;
}

export interface IOrderStatusHistory {
  status: OrderStatus;
  changedAt: Date;
}

export interface IOrderDocument extends Document {
  customerId: Types.ObjectId;
  merchantId: Types.ObjectId;
  delivererId?: Types.ObjectId;
  items: IOrderItem[];
  subtotal: number;
  commission: number;
  deliveryFee: number;
  total: number;
  status: OrderStatus;
  statusHistory: IOrderStatusHistory[];
  paymentMethod: string;
  deliveryAddress: IAddress;
  createdAt: Date;
  updatedAt: Date;
}

const ChosenOptionSchema = new Schema<IChosenOption>({
  groupName: { type: String, required: true },
  optionName: { type: String, required: true },
  price: { type: Number, required: true, default: 0 }
}, { _id: false });

const OrderItemSchema = new Schema<IOrderItem>({
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  name: { type: String, required: true },
  price: { type: Number, required: true },
  quantity: { type: Number, required: true, min: 1 },
  chosenOptions: { type: [ChosenOptionSchema], default: [] },
  notes: { type: String }
}, { _id: false });

const OrderStatusHistorySchema = new Schema<IOrderStatusHistory>({
  status: { 
    type: String, 
    required: true,
    enum: ['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'DISPATCHED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED']
  },
  changedAt: { type: Date, default: Date.now }
}, { _id: false });

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

const OrderSchema = new Schema<IOrderDocument>({
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
  merchantId: { type: Schema.Types.ObjectId, ref: 'Merchant', required: true, index: true },
  delivererId: { type: Schema.Types.ObjectId, ref: 'Deliverer', index: true },
  items: [OrderItemSchema],
  subtotal: { type: Number, required: true },
  commission: { type: Number, required: true },
  deliveryFee: { type: Number, required: true, default: 5 },
  total: { type: Number, required: true },
  status: { 
    type: String, 
    required: true, 
    enum: ['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'DISPATCHED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'],
    default: 'PENDING',
    index: true
  },
  statusHistory: [OrderStatusHistorySchema],
  paymentMethod: { type: String, required: true },
  deliveryAddress: { type: AddressSchema, required: true }
}, {
  timestamps: true
});

export const Order = model<IOrderDocument>('Order', OrderSchema);
