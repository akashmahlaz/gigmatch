/// 💰 GigMatch Subscription Service - Backend Implementation
///
/// Comprehensive subscription/payment service with Stripe integration
/// Features:
/// - Subscription tier management (Free, Pro, Premium)
/// - Stripe payment processing
/// - Subscription lifecycle management
/// - Payment method management
/// - Billing portal integration
/// - Invoice generation
/// - Webhook handling for payment events
/// - Feature access control
/// - Revenue tracking and analytics

import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { StripeService } from './stripe.service';
import { User, UserDocument } from '../schemas/user.schema';
import {
  Subscription,
  SubscriptionDocument,
  SubscriptionStatus,
} from '../schemas/subscription.schema';
import { Invoice, InvoiceDocument } from './schemas/invoice.schema';
import {
  PaymentMethod,
  PaymentMethodDocument,
} from './schemas/payment-method.schema';

interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  tier: string;
  monthlyPrice: number;
  yearlyPrice: number;
  stripePriceIdMonthly: string;
  stripePriceIdYearly: string;
  features: string[];
  isPopular: boolean;
  isAvailable: boolean;
}

interface CreateCheckoutDto {
  userId: string;
  priceId: string;
  isYearly: boolean;
  successUrl: string;
  cancelUrl: string;
}

interface UpdateSubscriptionDto {
  userId: string;
  newPriceId: string;
  isYearly: boolean;
}

interface PaymentMethodInput {
  paymentMethodId: string;
  setAsDefault?: boolean;
}

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);
  private readonly plans: Map<string, SubscriptionPlan> = new Map();

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Subscription.name)
    private subscriptionModel: Model<SubscriptionDocument>,
    @InjectModel(Invoice.name) private invoiceModel: Model<InvoiceDocument>,
    @InjectModel(PaymentMethod.name)
    private paymentMethodModel: Model<PaymentMethodDocument>,
    private configService: ConfigService,
    private stripeService: StripeService,
  ) {
    this.initializePlans();
  }

  /// Initialize subscription plans
  private initializePlans(): void {
    const plans: SubscriptionPlan[] = [
      {
        id: 'free',
        name: 'Free',
        description: 'Get started with basic features',
        tier: 'free',
        monthlyPrice: 0,
        yearlyPrice: 0,
        stripePriceIdMonthly: '',
        stripePriceIdYearly: '',
        features: [
          'Create artist/venue profile',
          'Basic discovery swiping',
          '5 gig applications per month',
          '3 media uploads',
          'Receive messages',
        ],
        isPopular: false,
        isAvailable: true,
      },
      {
        id: 'pro',
        name: 'Pro',
        description: 'For serious musicians and venues',
        tier: 'pro',
        monthlyPrice: 999, // $9.99 in cents
        yearlyPrice: 9999, // $99.99 in cents
        stripePriceIdMonthly:
          this.configService.get('STRIPE_PRO_MONTHLY_PRICE_ID') ||
          'price_pro_monthly',
        stripePriceIdYearly:
          this.configService.get('STRIPE_PRO_YEARLY_PRICE_ID') ||
          'price_pro_yearly',
        features: [
          'Everything in Free',
          'Profile boosting (5/month)',
          'See who viewed your profile',
          'See who liked you',
          'Advanced filters',
          'Message first',
          'Read receipts',
          '20 gig applications/month',
          'Analytics dashboard',
          '10 media uploads',
        ],
        isPopular: true,
        isAvailable: true,
      },
      {
        id: 'premium',
        name: 'Premium',
        description: 'For professional artists and venues',
        tier: 'premium',
        monthlyPrice: 1999, // $19.99 in cents
        yearlyPrice: 19999, // $199.99 in cents
        stripePriceIdMonthly:
          this.configService.get('STRIPE_PREMIUM_MONTHLY_PRICE_ID') ||
          'price_premium_monthly',
        stripePriceIdYearly:
          this.configService.get('STRIPE_PREMIUM_YEARLY_PRICE_ID') ||
          'price_premium_yearly',
        features: [
          'Everything in Pro',
          'Unlimited profile boosting',
          'Unlimited gig applications',
          'Unlimited media uploads',
          'Priority placement in search',
          'Featured profile badge',
          'Exclusive gig opportunities',
          'VIP support',
        ],
        isPopular: false,
        isAvailable: true,
      },
    ];

    for (const plan of plans) {
      this.plans.set(plan.id, plan);
    }
  }

  /// Get all available subscription plans
  async getPlans(): Promise<SubscriptionPlan[]> {
    return Array.from(this.plans.values()).filter((p) => p.isAvailable);
  }

  /// Get plan by ID
  async getPlan(planId: string): Promise<SubscriptionPlan | null> {
    return this.plans.get(planId) || null;
  }

  /// Get plan by tier
  async getPlanByTier(tier: string): Promise<SubscriptionPlan | null> {
    return Array.from(this.plans.values()).find((p) => p.tier === tier) || null;
  }

  /// Get current user subscription
  async getCurrentSubscription(
    userId: string,
  ): Promise<SubscriptionDocument | null> {
    const userIdObj = new Types.ObjectId(userId);
    return this.subscriptionModel.findOne({ userId: userIdObj }).exec();
  }

  /// Create checkout session for subscription
  async createCheckoutSession(
    dto: CreateCheckoutDto,
  ): Promise<{ sessionId: string; url: string }> {
    const userIdObj = new Types.ObjectId(dto.userId);
    const user = await this.userModel.findById(dto.userId).exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get or create Stripe customer
    let stripeCustomerId = user.stripeCustomerId;
    if (!stripeCustomerId) {
      stripeCustomerId = await this.stripeService.createCustomer({
        email: user.email,
        name: user.fullName,
        metadata: {
          userId: dto.userId,
        },
      });
      await this.userModel.findByIdAndUpdate(userIdObj, {
        stripeCustomerId,
      });
    }

    // Create checkout session
    const session = await this.stripeService.createCheckoutSession({
      customerId: stripeCustomerId,
      priceId: dto.priceId,
      successUrl: dto.successUrl,
      cancelUrl: dto.cancelUrl,
      metadata: {
        userId: dto.userId,
        isYearly: dto.isYearly.toString(),
      },
    });

    return {
      sessionId: session.id,
      url: session.url || '',
    };
  }

  /// Verify checkout completion and activate subscription
  async verifyCheckout(
    sessionId: string,
  ): Promise<{ success: boolean; subscription?: any }> {
    try {
      const session = await this.stripeService.getCheckoutSession(sessionId);

      if (session.payment_status !== 'paid') {
        return { success: false };
      }

      const userId = session.metadata?.userId;
      if (!userId) {
        return { success: false };
      }

      const isYearly = session.metadata?.isYearly === 'true';
      const priceId = session.line_items?.data[0]?.price?.id;

      if (!priceId) {
        return { success: false };
      }

      // Find the plan
      const plan = Array.from(this.plans.values()).find(
        (p) =>
          p.stripePriceIdMonthly === priceId ||
          p.stripePriceIdYearly === priceId,
      );

      if (!plan) {
        return { success: false };
      }

      // Create or update subscription
      const userIdObj = new Types.ObjectId(userId);
      const subscription = await this.createOrUpdateSubscription(
        userIdObj,
        plan.tier,
        session.subscription as string,
        session.customer as string,
        isYearly,
      );

      // Create invoice record
      await this.createInvoiceFromPayment(userIdObj, session, plan);

      return { success: true, subscription };
    } catch (error) {
      this.logger.error(`Checkout verification failed: ${error.message}`);
      return { success: false };
    }
  }

  /// Create or update subscription
  private async createOrUpdateSubscription(
    userId: Types.ObjectId,
    tier: string,
    stripeSubscriptionId: string,
    stripeCustomerId: string,
    isYearly: boolean,
  ): Promise<SubscriptionDocument> {
    let subscription = await this.subscriptionModel.findOne({ userId }).exec();

    if (subscription) {
      // Update existing subscription
      subscription.tier = tier;
      subscription.status = SubscriptionStatus.ACTIVE;
      subscription.stripeSubscriptionId = stripeSubscriptionId;
      subscription.stripeCustomerId = stripeCustomerId;
      subscription.isYearlyBilling = isYearly;
      subscription.cancelAtPeriodEnd = undefined;
      subscription.updatedAt = new Date();
    } else {
      // Create new subscription
      subscription = new this.subscriptionModel({
        userId,
        tier,
        status: 'active',
        stripeSubscriptionId,
        stripeCustomerId,
        isYearlyBilling: isYearly,
        hasActiveSubscription: true,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(
          Date.now() + (isYearly ? 365 : 30) * 24 * 60 * 60 * 1000,
        ),
        features: this.getFeaturesForTier(tier),
      });
    }

    await subscription.save();

    // Update user record
    await this.userModel.findByIdAndUpdate(userId, {
      subscriptionTier: tier,
      hasActiveSubscription: true,
      subscriptionId: subscription._id,
    });

    return subscription;
  }

  /// Get features for a tier
  private getFeaturesForTier(tier: string): Record<string, any> {
    switch (tier) {
      case 'pro':
        return {
          canBoostProfile: true,
          maxProfileBoosts: 5,
          canSeeViews: true,
          canSeeLikes: true,
          canUseAdvancedFilters: true,
          canMessageFirst: true,
          canSeeReadReceipts: true,
          maxGigApplications: 20,
          canAccessAnalytics: true,
          maxMediaUploads: 10,
        };
      case 'premium':
        return {
          canBoostProfile: true,
          maxProfileBoosts: -1, // Unlimited
          canSeeViews: true,
          canSeeLikes: true,
          canUseAdvancedFilters: true,
          canMessageFirst: true,
          canSeeReadReceipts: true,
          maxGigApplications: -1, // Unlimited
          canAccessAnalytics: true,
          maxMediaUploads: -1, // Unlimited
        };
      default: // Free
        return {
          canBoostProfile: false,
          maxProfileBoosts: 0,
          canSeeViews: false,
          canSeeLikes: false,
          canUseAdvancedFilters: false,
          canMessageFirst: false,
          canSeeReadReceipts: false,
          maxGigApplications: 5,
          canAccessAnalytics: false,
          maxMediaUploads: 3,
        };
    }
  }

  /// Cancel subscription
  async cancelSubscription(
    userId: string,
    immediately: boolean = false,
  ): Promise<SubscriptionDocument> {
    const userIdObj = new Types.ObjectId(userId);
    const subscription = await this.subscriptionModel
      .findOne({ userId: userIdObj })
      .exec();

    if (!subscription) {
      throw new NotFoundException('No active subscription found');
    }

    if (!subscription.stripeSubscriptionId) {
      throw new BadRequestException('No Stripe subscription associated');
    }

    if (immediately) {
      // Cancel immediately
      await this.stripeService.cancelSubscription(
        subscription.stripeSubscriptionId,
        true,
      );
      subscription.status = SubscriptionStatus.CANCELED;
      subscription.canceledAt = new Date();
      subscription.hasActiveSubscription = false;
    } else {
      // Cancel at period end
      await this.stripeService.cancelSubscription(
        subscription.stripeSubscriptionId,
        false,
      );
      subscription.cancelAtPeriodEnd = true;
      subscription.canceledAt = new Date();
    }

    subscription.updatedAt = new Date();
    await subscription.save();

    // Update user
    await this.userModel.findByIdAndUpdate(userIdObj, {
      subscriptionTier: 'free',
      hasActiveSubscription: false,
    });

    return subscription;
  }

  /// Resume canceled subscription
  async resumeSubscription(userId: string): Promise<SubscriptionDocument> {
    const userIdObj = new Types.ObjectId(userId);
    const subscription = await this.subscriptionModel
      .findOne({ userId: userIdObj })
      .exec();

    if (!subscription) {
      throw new NotFoundException('No subscription found');
    }

    if (!subscription.cancelAtPeriodEnd) {
      throw new BadRequestException('Subscription is not set to cancel');
    }

    if (!subscription.stripeSubscriptionId) {
      throw new BadRequestException('No Stripe subscription associated');
    }

    // Resume subscription
    await this.stripeService.resumeSubscription(
      subscription.stripeSubscriptionId,
    );
    subscription.cancelAtPeriodEnd = undefined;
    subscription.status = SubscriptionStatus.ACTIVE;
    subscription.updatedAt = new Date();

    await subscription.save();

    // Update user
    await this.userModel.findByIdAndUpdate(userIdObj, {
      subscriptionTier: subscription.tier,
      hasActiveSubscription: true,
    });

    return subscription;
  }

  /// Update subscription (upgrade/downgrade)
  async updateSubscription(
    dto: UpdateSubscriptionDto,
  ): Promise<SubscriptionDocument> {
    const userIdObj = new Types.ObjectId(dto.userId);
    const subscription = await this.subscriptionModel
      .findOne({ userId: userIdObj })
      .exec();

    if (!subscription) {
      throw new NotFoundException('No subscription found');
    }

    if (!subscription.stripeSubscriptionId) {
      throw new BadRequestException('No Stripe subscription associated');
    }

    // Update subscription in Stripe
    await this.stripeService.updateSubscription(
      subscription.stripeSubscriptionId,
      dto.newPriceId,
    );

    // Find new plan tier
    const newPlan = Array.from(this.plans.values()).find(
      (p) =>
        p.stripePriceIdMonthly === dto.newPriceId ||
        p.stripePriceIdYearly === dto.newPriceId,
    );

    if (!newPlan) {
      throw new BadRequestException('Invalid price ID');
    }

    // Update subscription record
    subscription.tier = newPlan.tier;
    subscription.isYearlyBilling = dto.isYearly;
    subscription.features = this.getFeaturesForTier(newPlan.tier);
    subscription.updatedAt = new Date();

    await subscription.save();

    // Update user
    await this.userModel.findByIdAndUpdate(userIdObj, {
      subscriptionTier: newPlan.tier,
    });

    return subscription;
  }

  /// Start free trial
  async startTrial(
    userId: string,
    tier: string,
  ): Promise<SubscriptionDocument> {
    const userIdObj = new Types.ObjectId(userId);
    const plan = this.plans.get(tier);

    if (!plan || tier === 'free') {
      throw new BadRequestException('Invalid tier for trial');
    }

    // Check if already has trial
    const existingSubscription = await this.subscriptionModel
      .findOne({ userId: userIdObj })
      .exec();
    if (
      existingSubscription &&
      existingSubscription.trialEnd &&
      existingSubscription.trialEnd > new Date()
    ) {
      throw new ConflictException('Already in trial period');
    }

    const subscription = new this.subscriptionModel({
      userId: userIdObj,
      tier,
      status: 'trialing',
      hasActiveSubscription: true,
      trialStart: new Date(),
      trialEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
      features: this.getFeaturesForTier(tier),
    });

    await subscription.save();

    // Update user
    await this.userModel.findByIdAndUpdate(userIdObj, {
      subscriptionTier: tier,
      hasActiveSubscription: true,
      subscriptionId: subscription._id,
    });

    return subscription;
  }

  /// Get remaining profile boosts
  async getRemainingBoosts(userId: string): Promise<number> {
    const userIdObj = new Types.ObjectId(userId);
    const subscription = await this.subscriptionModel
      .findOne({ userId: userIdObj })
      .exec();

    if (!subscription) {
      return 0;
    }

    return subscription.features?.maxProfileBoosts || 0;
  }

  /// Use a profile boost
  async useBoost(
    userId: string,
  ): Promise<{ success: boolean; remainingBoosts: number }> {
    const userIdObj = new Types.ObjectId(userId);
    const subscription = await this.subscriptionModel
      .findOne({ userId: userIdObj })
      .exec();

    if (!subscription) {
      return { success: false, remainingBoosts: 0 };
    }

    const maxBoosts = subscription.features?.maxProfileBoosts || 0;
    if (maxBoosts === 0) {
      return { success: false, remainingBoosts: 0 };
    }

    // In a real implementation, you'd track boost usage
    // For now, just return success
    return { success: true, remainingBoosts: maxBoosts - 1 };
  }

  /// Add payment method
  async addPaymentMethod(
    userId: string,
    dto: PaymentMethodInput,
  ): Promise<PaymentMethodDocument> {
    const userIdObj = new Types.ObjectId(userId);
    const user = await this.userModel.findById(userId).exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get or create Stripe customer
    let stripeCustomerId = user.stripeCustomerId;
    if (!stripeCustomerId) {
      stripeCustomerId = await this.stripeService.createCustomer({
        email: user.email,
        name: user.fullName,
      });
      await this.userModel.findByIdAndUpdate(userIdObj, { stripeCustomerId });
    }

    // Attach payment method to customer
    await this.stripeService.attachPaymentMethod(
      dto.paymentMethodId,
      stripeCustomerId,
    );

    // Set as default if requested
    if (dto.setAsDefault) {
      await this.stripeService.setDefaultPaymentMethod(
        stripeCustomerId,
        dto.paymentMethodId,
      );
    }

    // Get payment method details from Stripe
    const stripePaymentMethod = await this.stripeService.getPaymentMethod(
      dto.paymentMethodId,
    );

    if (!stripePaymentMethod) {
      throw new BadRequestException('Payment method not found');
    }

    // Create payment method record
    let paymentMethod = await this.paymentMethodModel
      .findOne({
        stripePaymentMethodId: dto.paymentMethodId,
      })
      .exec();

    if (paymentMethod) {
      paymentMethod.isDefault = dto.setAsDefault || false;
    } else {
      paymentMethod = new this.paymentMethodModel({
        userId: userIdObj,
        stripePaymentMethodId: dto.paymentMethodId,
        type: stripePaymentMethod.type || 'card',
        brand: stripePaymentMethod.card?.brand,
        last4: stripePaymentMethod.card?.last4,
        expiryMonth: stripePaymentMethod.card?.exp_month,
        expiryYear: stripePaymentMethod.card?.exp_year,
        isDefault: dto.setAsDefault || false,
      });
    }

    await paymentMethod.save();

    return paymentMethod;
  }

  /// Get user payment methods
  async getPaymentMethods(userId: string): Promise<PaymentMethodDocument[]> {
    return this.paymentMethodModel
      .find({ user: new Types.ObjectId(userId) })
      .exec();
  }

  /// Set default payment method
  async setDefaultPaymentMethod(
    userId: string,
    paymentMethodId: string,
  ): Promise<void> {
    const userIdObj = new Types.ObjectId(userId);

    // Update in Stripe
    const user = await this.userModel.findById(userId).exec();
    if (user?.stripeCustomerId) {
      await this.stripeService.setDefaultPaymentMethod(
        user.stripeCustomerId,
        paymentMethodId,
      );
    }

    // Update local records
    await this.paymentMethodModel
      .updateMany({ userId: userIdObj }, { isDefault: false })
      .exec();

    await this.paymentMethodModel
      .findOneAndUpdate(
        { _id: new Types.ObjectId(paymentMethodId), user: userIdObj },
        { isDefault: true },
      )
      .exec();
  }

  /// Remove payment method
  async removePaymentMethod(
    userId: string,
    paymentMethodId: string,
  ): Promise<void> {
    const paymentMethod = await this.paymentMethodModel
      .findOne({
        _id: new Types.ObjectId(paymentMethodId),
        user: new Types.ObjectId(userId),
      })
      .exec();

    if (!paymentMethod) {
      throw new NotFoundException('Payment method not found');
    }

    // Detach from Stripe
    if (paymentMethod.stripePaymentMethodId) {
      await this.stripeService.detachPaymentMethod(
        paymentMethod.stripePaymentMethodId,
      );
    }

    // Delete local record
    await this.paymentMethodModel.findByIdAndDelete(paymentMethod._id).exec();
  }

  /// Get invoices
  async getInvoices(
    userId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{ invoices: InvoiceDocument[]; hasMore: boolean }> {
    const userIdObj = new Types.ObjectId(userId);

    const invoices = await this.invoiceModel
      .find({ userId: userIdObj })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit + 1)
      .exec();

    const hasMore = invoices.length > limit;
    if (hasMore) {
      invoices.pop();
    }

    return { invoices, hasMore };
  }

  /// Create invoice from payment
  private async createInvoiceFromPayment(
    userId: Types.ObjectId,
    session: any,
    plan: SubscriptionPlan,
  ): Promise<InvoiceDocument> {
    const invoice = new this.invoiceModel({
      user: userId,
      stripeInvoiceId: session.invoice as string,
      stripePaymentIntentId: session.payment_intent,
      amount: session.amount_paid,
      currency: session.currency?.toUpperCase() || 'USD',
      description: `${plan.name} Subscription (${session.metadata?.isYearly === 'true' ? 'Yearly' : 'Monthly'})`,
      status: 'paid',
      paidAt: new Date(),
    });

    await invoice.save();
    return invoice;
  }

  /// Create billing portal session
  async createBillingPortalSession(
    userId: string,
    returnUrl: string,
  ): Promise<{ url: string }> {
    const user = await this.userModel.findById(userId).exec();

    if (!user?.stripeCustomerId) {
      throw new BadRequestException('No billing account found');
    }

    const session = await this.stripeService.createBillingPortalSession(
      user.stripeCustomerId,
      returnUrl,
    );

    return { url: session.url };
  }

  /// Handle Stripe webhook events
  async handleWebhook(event: any): Promise<void> {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object);
        break;
      case 'invoice.paid':
        await this.handleInvoicePaid(event.data.object);
        break;
      case 'invoice.payment_failed':
        await this.handleInvoiceFailed(event.data.object);
        break;
      default:
        this.logger.log(`Unhandled webhook event: ${event.type}`);
    }
  }

  /// Handle subscription updated webhook
  private async handleSubscriptionUpdated(subscription: any): Promise<void> {
    const customerId = subscription.customer as string;
    const user = await this.userModel
      .findOne({ stripeCustomerId: customerId })
      .exec();

    if (!user) {
      this.logger.warn(`User not found for Stripe customer: ${customerId}`);
      return;
    }

    const userIdObj = new Types.ObjectId(user._id);
    const existingSubscription = await this.subscriptionModel
      .findOne({ userId: userIdObj })
      .exec();

    if (existingSubscription) {
      existingSubscription.status = this.mapStripeStatus(subscription.status);
      existingSubscription.currentPeriodStart = new Date(
        subscription.current_period_start * 1000,
      );
      existingSubscription.currentPeriodEnd = new Date(
        subscription.current_period_end * 1000,
      );
      existingSubscription.cancelAtPeriodEnd =
        subscription.cancel_at_period_end === true;
      existingSubscription.updatedAt = new Date();
      await existingSubscription.save();
    }
  }

  /// Handle subscription deleted webhook
  private async handleSubscriptionDeleted(subscription: any): Promise<void> {
    const customerId = subscription.customer as string;
    const user = await this.userModel
      .findOne({ stripeCustomerId: customerId })
      .exec();

    if (!user) return;

    const userIdObj = new Types.ObjectId(user._id);
    await this.subscriptionModel
      .findOneAndUpdate(
        { userId: userIdObj },
        {
          status: 'canceled',
          hasActiveSubscription: false,
          canceledAt: new Date(),
          updatedAt: new Date(),
        },
      )
      .exec();

    // Update user
    await this.userModel.findByIdAndUpdate(userIdObj, {
      subscriptionTier: 'free',
      hasActiveSubscription: false,
    });
  }

  /// Handle invoice paid webhook
  private async handleInvoicePaid(invoice: any): Promise<void> {
    const customerId = invoice.customer as string;
    const user = await this.userModel
      .findOne({ stripeCustomerId: customerId })
      .exec();

    if (!user) return;

    // Create invoice record if not exists
    const existingInvoice = await this.invoiceModel
      .findOne({
        stripeInvoiceId: invoice.id,
      })
      .exec();

    if (!existingInvoice) {
      const invoiceDoc = new this.invoiceModel({
        user: user._id,
        stripeInvoiceId: invoice.id,
        stripePaymentIntentId: invoice.payment_intent,
        amount: invoice.amount_paid,
        currency: invoice.currency?.toUpperCase() || 'USD',
        description: invoice.description,
        status: 'paid',
        paidAt: new Date(),
      });
      await invoiceDoc.save();
    }
  }

  /// Handle invoice failed webhook
  private async handleInvoiceFailed(invoice: any): Promise<void> {
    const customerId = invoice.customer as string;
    const user = await this.userModel
      .findOne({ stripeCustomerId: customerId })
      .exec();

    if (!user) return;

    // Update subscription status
    await this.subscriptionModel
      .findOneAndUpdate(
        { user: user._id },
        { status: 'past_due', updatedAt: new Date() },
      )
      .exec();

    // TODO: Send notification to user about payment failure
    this.logger.warn(`Payment failed for user ${user._id}`);
  }

  /// Map Stripe subscription status to internal status
  private mapStripeStatus(stripeStatus: string): SubscriptionStatus {
    switch (stripeStatus) {
      case 'active':
        return SubscriptionStatus.ACTIVE;
      case 'past_due':
        return SubscriptionStatus.PAST_DUE;
      case 'canceled':
        return SubscriptionStatus.CANCELED;
      case 'unpaid':
        return SubscriptionStatus.UNPAID;
      case 'trialing':
        return SubscriptionStatus.TRIALING;
      case 'paused':
        return SubscriptionStatus.PAUSED;
      default:
        return SubscriptionStatus.ACTIVE;
    }
  }

  /// Restore purchases (for iOS subscriptions)
  async restorePurchases(
    userId: string,
  ): Promise<{ success: boolean; subscription?: any }> {
    // In a real implementation, this would verify receipts with Apple/Google
    // For now, just check if user already has an active subscription
    const subscription = await this.getCurrentSubscription(userId);
    return {
      success:
        (subscription !== null && subscription.hasActiveSubscription) ||
        false ||
        false,
      subscription,
    };
  }

  /// Check feature access
  async checkFeatureAccess(userId: string, feature: string): Promise<boolean> {
    const subscription = await this.getCurrentSubscription(userId);

    if (!subscription || !subscription.hasActiveSubscription || false) {
      // Check free tier access
      const freeFeatures = this.getFeaturesForTier('free');
      return freeFeatures[feature] || false;
    }

    return (subscription.features || {})[feature] || false;
  }

  /// Get feature access for user
  async getFeatureAccess(userId: string): Promise<Record<string, any>> {
    const subscription = await this.getCurrentSubscription(userId);

    if ((subscription && subscription.hasActiveSubscription) || false) {
      return subscription.features || {};
    }

    return this.getFeaturesForTier('free');
  }

  /// Sync subscription from Stripe
  async syncSubscription(userId: string): Promise<void> {
    const subscription = await this.getCurrentSubscription(userId);

    if (!subscription?.stripeSubscriptionId) return;

    try {
      const stripeSubscription = await this.stripeService.getSubscription(
        subscription.stripeSubscriptionId,
      );

      subscription.status = this.mapStripeStatus(stripeSubscription.status);
      subscription.currentPeriodStart = new Date(
        (stripeSubscription as any).current_period_start * 1000,
      );
      subscription.currentPeriodEnd = new Date(
        (stripeSubscription as any).current_period_end * 1000,
      );
      subscription.cancelAtPeriodEnd =
        (stripeSubscription as any).cancel_at_period_end === true;
      subscription.updatedAt = new Date();

      await subscription.save();
    } catch (error) {
      this.logger.error(`Failed to sync subscription: ${error.message}`);
    }
  }

  /// Get subscription statistics (for admin)
  async getStats(period: string = 'month'): Promise<any> {
    const startDate = this.getStartDate(period);

    const [
      totalSubscriptions,
      activeSubscriptions,
      totalRevenue,
      revenueByTier,
      churnedSubscriptions,
    ] = await Promise.all([
      this.subscriptionModel.countDocuments().exec(),
      this.subscriptionModel.countDocuments({ status: 'active' }).exec(),
      this.invoiceModel
        .aggregate([
          { $match: { status: 'paid', createdAt: { $gte: startDate } } },
          { $group: { _id: null, total: { $sum: '$amount' } } },
        ])
        .exec(),
      this.invoiceModel
        .aggregate([
          { $match: { status: 'paid', createdAt: { $gte: startDate } } },
          {
            $group: {
              _id: '$description',
              total: { $sum: '$amount' },
            },
          },
        ])
        .exec(),
      this.subscriptionModel
        .countDocuments({
          status: 'canceled',
          canceledAt: { $gte: startDate },
        })
        .exec(),
    ]);

    return {
      totalSubscriptions,
      activeSubscriptions,
      totalRevenue: totalRevenue[0]?.total || 0,
      revenueByTier,
      churnedSubscriptions,
      periodStart: startDate,
      periodEnd: new Date(),
    };
  }

  /// Get start date for period
  private getStartDate(period: string): Date {
    const now = new Date();
    switch (period) {
      case 'today':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
      case 'week':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case 'month':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case 'year':
        return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
  }
}

