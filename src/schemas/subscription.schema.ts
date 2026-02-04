import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type SubscriptionDocument = HydratedDocument<Subscription>;

// Subscription status enum for type safety
export enum SubscriptionStatus {
  ACTIVE = 'active',
  CANCELLED = 'cancelled',
  CANCELED = 'canceled', // Alias for compatibility
  PAST_DUE = 'past_due',
  EXPIRED = 'expired',
  TRIALING = 'trialing',
  UNPAID = 'unpaid',
  PAUSED = 'paused',
}

// Subscription plan enum for type safety
export enum SubscriptionPlan {
  FREE = 'free',
  PRO = 'pro',
  PREMIUM = 'premium',
}

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
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Artist' })
  artist?: Types.ObjectId;

  // Plan
  @Prop({
    required: true,
    enum: ['free', 'pro', 'premium'],
    default: 'free',
  })
  plan: 'free' | 'pro' | 'premium';

  // Status
  @Prop({
    enum: Object.values(SubscriptionStatus),
    default: SubscriptionStatus.ACTIVE,
  })
  status: SubscriptionStatus;

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
  @Prop({ type: Array })
  paymentHistory?: {
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

  @Prop()
  trialEnd?: Date;

  // Tier (alias for plan, used by subscription service)
  @Prop({ default: 'free', enum: ['free', 'pro', 'premium'] })
  tier: string;

  // Billing flags
  @Prop({ default: false })
  isYearlyBilling?: boolean;

  @Prop({ default: false })
  hasActiveSubscription?: boolean;

  @Prop()
  updatedAt?: Date;

  // Features (based on plan)
  @Prop({ type: Object })
  features?: Record<string, any> | {
    dailySwipeLimit: number;
    canSeeWhoLikedYou: boolean;
    boostsPerMonth: number;
    maxProfileBoosts?: number;
    priorityInSearch: boolean;
    advancedAnalytics: boolean;
    customProfileUrl: boolean;
    verifiedBadge: boolean;
    unlimitedMessages: boolean;
    canSeeViews: boolean;
    canUseAdvancedFilters: boolean;
    canMessageFirst: boolean;
    canSeeReadReceipts: boolean;
    maxGigApplications: number;
    canAccessAnalytics: boolean;
    maxMediaUploads: number;
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
  @Prop({ type: Boolean })
  cancelAtPeriodEnd?: boolean;

  @Prop()
  cancelledAt?: Date;

  @Prop()
  canceledAt?: Date; // Alias for American spelling

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
