/// 📋 Subscription Schema
/// Stores user subscription information

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum SubscriptionStatus {
  ACTIVE = 'active',
  PAST_DUE = 'past_due',
  CANCELED = 'canceled',
  UNPAID = 'unpaid',
  TRIALING = 'trialing',
  INCOMPLETE = 'incomplete',
  INCOMPLETE_EXPIRED = 'incomplete_expired',
  PAUSED = 'paused',
}

export enum SubscriptionPlan {
  FREE = 'free',
  ARTIST_BASIC = 'artist_basic',
  ARTIST_PRO = 'artist_pro',
  VENUE_BASIC = 'venue_basic',
  VENUE_PRO = 'venue_pro',
  ENTERPRISE = 'enterprise',
}

@Schema({ timestamps: true })
export class Subscription {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: String, enum: Object.values(SubscriptionPlan), required: true })
  plan: SubscriptionPlan;

  @Prop({ type: String, enum: Object.values(SubscriptionStatus), default: SubscriptionStatus.ACTIVE })
  status: SubscriptionStatus;

  @Prop({ type: String })
  stripeSubscriptionId?: string;

  @Prop({ type: String })
  stripeCustomerId?: string;

  @Prop({ type: Date })
  currentPeriodStart?: Date;

  @Prop({ type: Date })
  currentPeriodEnd?: Date;

  @Prop({ type: Date })
  cancelAtPeriodEnd?: Date;

  @Prop({ type: Date })
  canceledAt?: Date;

  @Prop({ type: Date })
  trialEnd?: Date;

  @Prop({ type: Number, default: 1 })
  quantity: number;

  @Prop({ type: Number })
  amount?: number;

  @Prop({ type: String })
  currency?: string;

  @Prop({ type: String, enum: ['month', 'year', 'week', 'day'] })
  interval?: string;

  @Prop({ type: Date })
  nextBillingDate?: Date;

  @Prop({ type: String, default: "free" })
  tier?: string;

  @Prop({ type: Boolean, default: false })
  isYearlyBilling?: boolean;

  @Prop({ type: Boolean, default: false })
  hasActiveSubscription?: boolean;

  @Prop({ type: Object })
  features?: Record<string, any>;

  @Prop({ type: Date })
  updatedAt?: Date;
}

export type SubscriptionDocument = Subscription & Document;
export const SubscriptionSchema = SchemaFactory.createForClass(Subscription);

// Indexes
SubscriptionSchema.index({ userId: 1 }, { unique: true });
SubscriptionSchema.index({ stripeSubscriptionId: 1 });
SubscriptionSchema.index({ status: 1 });
SubscriptionSchema.index({ nextBillingDate: 1 });
