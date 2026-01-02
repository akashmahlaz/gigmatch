import { Prop, Schema, SchemaFactory, raw } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type SubscriptionDocument = HydratedDocument<Subscription>;

/**
 * 💳 SUBSCRIPTION SCHEMA
 *
 * Artist subscription management.
 * Venues are FREE, Artists have tiered subscriptions.
 *
 * Plans:
 * - FREE: Basic profile, limited swipes, no boosts
 * - BASIC: Unlimited swipes, basic analytics
 * - PRO: Everything + boosts, priority in search, advanced analytics
 */
@Schema({
  timestamps: true,
  collection: 'subscriptions',
  toJSON: { virtuals: true },
})
export class Subscription {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
  user: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Artist' })
  artist?: Types.ObjectId;

  // Plan
  @Prop({
    required: true,
    enum: ['free', 'basic', 'pro'],
    default: 'free',
  })
  plan: 'free' | 'basic' | 'pro';

  // Status
  @Prop({
    enum: ['active', 'cancelled', 'past_due', 'expired', 'trialing'],
    default: 'active',
  })
  status: 'active' | 'cancelled' | 'past_due' | 'expired' | 'trialing';

  // Billing cycle
  @Prop({ enum: ['monthly', 'yearly'], default: 'monthly' })
  billingCycle: 'monthly' | 'yearly';

  @Prop()
  currentPeriodStart?: Date;

  @Prop()
  currentPeriodEnd?: Date;

  // Stripe
  @Prop()
  stripeSubscriptionId?: string;

  @Prop()
  stripePriceId?: string;

  @Prop()
  stripeCustomerId?: string;

  // Payment history
  @Prop(
    raw([
      {
        amount: { type: Number, required: true },
        currency: { type: String, default: 'USD' },
        status: {
          type: String,
          enum: ['succeeded', 'failed', 'pending', 'refunded'],
        },
        stripePaymentIntentId: { type: String },
        paidAt: { type: Date },
        invoiceUrl: { type: String },
      },
    ]),
  )
  paymentHistory: {
    amount: number;
    currency: string;
    status: 'succeeded' | 'failed' | 'pending' | 'refunded';
    stripePaymentIntentId?: string;
    paidAt?: Date;
    invoiceUrl?: string;
  }[];

  // Trial
  @Prop({ default: false })
  hasUsedTrial: boolean;

  @Prop()
  trialEndsAt?: Date;

  // Features (based on plan)
  @Prop(
    raw({
      dailySwipeLimit: { type: Number, default: 10 },
      canSeeWhoLikedYou: { type: Boolean, default: false },
      boostsPerMonth: { type: Number, default: 0 },
      priorityInSearch: { type: Boolean, default: false },
      advancedAnalytics: { type: Boolean, default: false },
      customProfileUrl: { type: Boolean, default: false },
      verifiedBadge: { type: Boolean, default: false },
      unlimitedMessages: { type: Boolean, default: true },
    }),
  )
  features: {
    dailySwipeLimit: number;
    canSeeWhoLikedYou: boolean;
    boostsPerMonth: number;
    priorityInSearch: boolean;
    advancedAnalytics: boolean;
    customProfileUrl: boolean;
    verifiedBadge: boolean;
    unlimitedMessages: boolean;
  };

  // Usage tracking
  @Prop({ default: 0 })
  swipesToday: number;

  @Prop()
  lastSwipeResetAt?: Date;

  @Prop({ default: 0 })
  boostsUsedThisMonth: number;

  @Prop()
  lastBoostResetAt?: Date;

  // Cancellation
  @Prop({ default: false })
  cancelAtPeriodEnd: boolean;

  @Prop()
  cancelledAt?: Date;

  @Prop()
  cancellationReason?: string;
}

export const SubscriptionSchema = SchemaFactory.createForClass(Subscription);

// Indexes (user index already created by unique: true)
SubscriptionSchema.index({ artist: 1 });
SubscriptionSchema.index({ status: 1 });
SubscriptionSchema.index({ plan: 1 });
SubscriptionSchema.index({ currentPeriodEnd: 1 });
SubscriptionSchema.index({ stripeSubscriptionId: 1 });
