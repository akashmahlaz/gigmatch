/// 💰 Wallet Schema - MongoDB Schema for Wallet & Payouts
///
/// Stores wallet balances, transactions, and payout methods for artists

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

/// Transaction types
export enum TransactionType {
  EARNING = 'earning',
  PAYOUT = 'payout',
  REFUND = 'refund',
  FEE = 'fee',
  ADJUSTMENT = 'adjustment',
  TIP = 'tip',
  BONUS = 'bonus',
}

/// Transaction status
export enum TransactionStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELED = 'canceled',
}

/// Payout status
export enum PayoutStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELED = 'canceled',
}

/// Payout method types
export enum PayoutMethodType {
  BANK_ACCOUNT = 'bank_account',
  DEBIT_CARD = 'debit_card',
  PAYPAL = 'paypal',
  VENMO = 'venmo',
}

/// Transaction schema
@Schema({ timestamps: true })
export class Transaction {
  @ApiProperty()
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @ApiProperty({ enum: TransactionType })
  @Prop({ type: String, enum: Object.values(TransactionType), required: true })
  type: TransactionType;

  @ApiProperty()
  @Prop({ type: Number, required: true })
  amount: number;

  @ApiProperty()
  @Prop({ type: String, default: 'USD' })
  currency: string;

  @ApiProperty({ enum: TransactionStatus })
  @Prop({ type: String, enum: Object.values(TransactionStatus), default: TransactionStatus.PENDING })
  status: TransactionStatus;

  @ApiProperty()
  @Prop({ type: String })
  description?: string;

  @ApiProperty()
  @Prop({ type: Types.ObjectId, ref: 'Booking' })
  bookingId?: Types.ObjectId;

  @ApiProperty()
  @Prop({ type: Types.ObjectId, ref: 'Gig' })
  gigId?: Types.ObjectId;

  @ApiProperty()
  @Prop({ type: String })
  stripeTransferId?: string;

  @ApiProperty()
  @Prop({ type: String })
  stripePayoutId?: string;

  @ApiProperty()
  @Prop({ type: Object, default: {} })
  metadata?: Record<string, any>;
}

export type TransactionDocument = Transaction & Document;
export const TransactionSchema = SchemaFactory.createForClass(Transaction);

/// Payout method schema
@Schema({ timestamps: true })
export class PayoutMethod {
  @ApiProperty()
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @ApiProperty({ enum: PayoutMethodType })
  @Prop({ type: String, enum: Object.values(PayoutMethodType), required: true })
  type: PayoutMethodType;

  @ApiProperty()
  @Prop({ type: String })
  displayName?: string;

  @ApiProperty()
  @Prop({ type: String })
  last4?: string;

  @ApiProperty()
  @Prop({ type: String })
  bankName?: string;

  @ApiProperty()
  @Prop({ type: String })
  stripeExternalAccountId?: string;

  @ApiProperty()
  @Prop({ type: Boolean, default: false })
  isDefault: boolean;

  @ApiProperty()
  @Prop({ type: Boolean, default: true })
  isActive: boolean;
}

export type PayoutMethodDocument = PayoutMethod & Document;
export const PayoutMethodSchema = SchemaFactory.createForClass(PayoutMethod);

/// Payout request schema
@Schema({ timestamps: true })
export class PayoutRequest {
  @ApiProperty()
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @ApiProperty()
  @Prop({ type: Number, required: true })
  amount: number;

  @ApiProperty()
  @Prop({ type: String, default: 'USD' })
  currency: string;

  @ApiProperty({ enum: PayoutStatus })
  @Prop({ type: String, enum: Object.values(PayoutStatus), default: PayoutStatus.PENDING })
  status: PayoutStatus;

  @ApiProperty()
  @Prop({ type: Types.ObjectId, ref: 'PayoutMethod' })
  payoutMethodId?: Types.ObjectId;

  @ApiProperty()
  @Prop({ type: String })
  stripePayoutId?: string;

  @ApiProperty()
  @Prop({ type: Date })
  processedAt?: Date;

  @ApiProperty()
  @Prop({ type: Date })
  paidAt?: Date;

  @ApiProperty()
  @Prop({ type: String })
  failureReason?: string;
}

export type PayoutRequestDocument = PayoutRequest & Document;
export const PayoutRequestSchema = SchemaFactory.createForClass(PayoutRequest);

/// Wallet schema (virtual entity representing user's wallet)
@Schema({ timestamps: true })
export class Wallet {
  @ApiProperty()
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
  userId: Types.ObjectId;

  @ApiProperty()
  @Prop({ type: Number, default: 0 })
  availableBalance: number;

  @ApiProperty()
  @Prop({ type: Number, default: 0 })
  pendingBalance: number;

  @ApiProperty()
  @Prop({ type: Number, default: 0 })
  totalEarnings: number;

  @ApiProperty()
  @Prop({ type: Number, default: 0 })
  totalPaidOut: number;

  @ApiProperty()
  @Prop({ type: String, default: 'USD' })
  currency: string;

  @ApiProperty()
  @Prop({ type: String })
  stripeConnectAccountId?: string;

  @ApiProperty()
  @Prop({ type: Boolean, default: false })
  stripeOnboardingComplete: boolean;

  @ApiProperty()
  @Prop({ type: Date })
  lastPayoutAt?: Date;
}

export type WalletDocument = Wallet & Document;
export const WalletSchema = SchemaFactory.createForClass(Wallet);
