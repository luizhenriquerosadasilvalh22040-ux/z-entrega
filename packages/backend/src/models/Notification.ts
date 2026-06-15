import { Schema, model, Document, Types } from 'mongoose';

export interface INotificationDocument extends Document {
  userId: Types.ObjectId;
  userType: 'Customer' | 'Merchant' | 'Deliverer';
  type: 'WhatsApp' | 'Email' | 'SMS';
  target: string; // e.g. Telefone ou Email
  content: string;
  status: 'PENDING' | 'SENT' | 'FAILED';
  attempts: number;
  errorLog?: string[];
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotificationDocument>({
  userId: { type: Schema.Types.ObjectId, required: true, index: true },
  userType: { type: String, required: true, enum: ['Customer', 'Merchant', 'Deliverer'] },
  type: { type: String, required: true, enum: ['WhatsApp', 'Email', 'SMS'] },
  target: { type: String, required: true },
  content: { type: String, required: true },
  status: { type: String, required: true, enum: ['PENDING', 'SENT', 'FAILED'], default: 'PENDING', index: true },
  attempts: { type: Number, default: 0 },
  errorLog: [{ type: String }]
}, {
  timestamps: true
});

export const Notification = model<INotificationDocument>('Notification', NotificationSchema);
