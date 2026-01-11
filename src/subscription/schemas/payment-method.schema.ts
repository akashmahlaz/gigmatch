/// 💳 Payment Method Schema
/// Stores payment method information for subscriptions

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum PaymentMethodType {
  CARD = 'card',
  BANK_ACCOUNT = 'bank_account',
}

@Schema({ timestamps: true })
export class PaymentMethod {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: String, required: true })
  stripePaymentMethodId: string;

  @Prop({ type: String, enum: Object.values(PaymentMethodType), required: true })
  type: PaymentMethodType;

  @Prop({ type: String })
  brand?: string;

  @Prop({ type: String })
  last4?: string;

  @Prop({ type: Number })
  expiryMonth?: number;

  @Prop({ type: Number })
  expiryYear?: number;

  @Prop({ type: Boolean, default: false })
  isDefault: boolean;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;
}

export type PaymentMethodDocument = PaymentMethod & Document;
export const PaymentMethodSchema = SchemaFactory.createForClass(PaymentMethod);

// Indexes
PaymentMethodSchema.index({ userId: 1, isDefault: 1 });
PaymentMethodSchema.index({ stripePaymentMethodId: 1 }, { unique: true });
