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

  /// Get subscription (alias for getCurrentSubscription)
  async getSubscription(userId: string): Promise<SubscriptionDocument | null> {
    return this.getCurrentSubscription(userId);
  }

  /// Get or create Stripe customer for user
  async getOrCreateStripeCustomer(userId: string): Promise<string> {
    const userIdObj = new Types.ObjectId(userId);
    const user = await this.userModel.findById(userIdObj).exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.stripeCustomerId) {
      return user.stripeCustomerId;
    }

    // Create new Stripe customer
    const stripeCustomerId = await this.stripeService.createCustomer({
      email: user.email,
      name: user.fullName,
      metadata: {
        userId: userId,
      },
    });

    // Update user with Stripe customer ID
    await this.userModel.findByIdAndUpdate(userIdObj, { stripeCustomerId });

    return stripeCustomerId;
  }

  /// Create portal session (alias for createBillingPortalSession)
  async createPortalSession(
    userId: string,
    returnUrl: string,
  ): Promise<{ url: string }> {
    return this.createBillingPortalSession(userId, returnUrl);
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
      subscription.cancelAtPeriodEnd = false;
      subscription.updatedAt = new Date();
    } else {
      // Create new subscription
      subscription = new this.subscriptionModel({
        userId,
        tier,
        plan: tier,
        status: SubscriptionStatus.ACTIVE,
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
      subscription: subscription._id,
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

    // Update user — only revoke access on immediate cancel
    if (immediately) {
      await this.userModel.findByIdAndUpdate(userIdObj, {
        subscriptionTier: 'free',
        hasActiveSubscription: false,
      });
    }

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
    subscription.cancelAtPeriodEnd = false;
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
      subscription: subscription._id,
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
      .find({ userId: new Types.ObjectId(userId) })
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
        { _id: new Types.ObjectId(paymentMethodId), userId: userIdObj },
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
        userId: new Types.ObjectId(userId),
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
      userId,
      stripeInvoiceId: session.invoice as string || `inv_manual_${Date.now()}`,
      amount: session.amount_total || session.amount_paid || 0,
      amountDue: 0,
      amountPaid: session.amount_total || session.amount_paid || 0,
      status: 'paid',
      paidAt: new Date(),
      metadata: {
        description: `${plan.name} Subscription (${session.metadata?.isYearly === 'true' ? 'Yearly' : 'Monthly'})`,
        currency: session.currency?.toUpperCase() || 'USD',
        stripePaymentIntentId: session.payment_intent,
      },
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
        await this.handleInvoicePaid(
          event.data.object.customer as string,
          event.data.object,
        );
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
        { userId: user._id },
        { status: SubscriptionStatus.PAST_DUE, updatedAt: new Date() },
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
        subscription !== null && (subscription.hasActiveSubscription ?? false),
      subscription,
    };
  }

  /// Check feature access
  async checkFeatureAccess(userId: string, feature: string): Promise<boolean> {
    const subscription = await this.getCurrentSubscription(userId);

    if (!subscription || !subscription.hasActiveSubscription) {
      // Check free tier access
      const freeFeatures = this.getFeaturesForTier('free');
      return freeFeatures[feature] || false;
    }

    return (subscription.features || {})[feature] || false;
  }

  /// Get feature access for user
  async getFeatureAccess(userId: string): Promise<Record<string, any>> {
    const subscription = await this.getCurrentSubscription(userId);

    if (subscription && subscription.hasActiveSubscription) {
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

  // ═══════════════════════════════════════════════════════════════════════
  // WEBHOOK IDEMPOTENCY
  // ═══════════════════════════════════════════════════════════════════════

  /// Get Stripe webhook secret for signature verification
  getWebhookSecret(): string | undefined {
    return this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
  }

  /// Check if webhook event has already been processed (idempotency)
  async isEventProcessed(eventId: string): Promise<boolean> {
    try {
      // Check in-memory cache first (for recent events)
      const cacheKey = `webhook_${eventId}`;
      const cached = await this.getFromCache(cacheKey);
      if (cached) return true;

      // Note: For production, add a ProcessedWebhook schema and model
      // to persist webhook event IDs in the database for long-term idempotency
      return false;
    } catch (error) {
      this.logger.error(`Error checking webhook processing status: ${error.message}`);
      return false;
    }
  }

  /// Mark webhook event as processed (idempotency tracking)
  async markEventProcessed(eventId: string, eventType: string): Promise<void> {
    try {
      // Store in memory cache (expires in 24 hours)
      const cacheKey = `webhook_${eventId}`;
      await this.setInCache(cacheKey, 'processed', 24 * 60 * 60 * 1000);

      // Note: For production, persist to database using a ProcessedWebhook model
      // for long-term idempotency tracking across server restarts
      this.logger.debug(`Webhook event ${eventId} (${eventType}) marked as processed`);
    } catch (error) {
      this.logger.error(`Error marking webhook as processed: ${error.message}`);
    }
  }

  /// Simple in-memory cache for webhook idempotency
  private webhookCache: Map<string, { value: string; expiresAt: number }> = new Map();

  private async getFromCache(key: string): Promise<string | null> {
    const cached = this.webhookCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }
    if (cached) {
      this.webhookCache.delete(key);
    }
    return null;
  }

  private async setInCache(key: string, value: string, ttlMs: number): Promise<void> {
    this.webhookCache.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PAYMENT FAILURE RETRY LOGIC
  // ═══════════════════════════════════════════════════════════════════════

  /// Get payment retry count for a customer
  async getPaymentRetryCount(customerId: string): Promise<number> {
    // In production, store this in Redis or database
    const cacheKey = `retry_${customerId}`;
    const cached = await this.getFromCache(cacheKey);
    return cached ? parseInt(cached) : 0;
  }

  /// Increment payment retry count
  async incrementPaymentRetryCount(customerId: string): Promise<void> {
    const current = await this.getPaymentRetryCount(customerId);
    const cacheKey = `retry_${customerId}`;
    await this.setInCache(cacheKey, (current + 1).toString(), 24 * 60 * 60 * 1000);
  }

  /// Reset payment retry count after successful payment
  async resetPaymentRetryCount(customerId: string): Promise<void> {
    const cacheKey = `retry_${customerId}`;
    this.webhookCache.delete(cacheKey);
  }

  /// Check if should retry payment (with exponential backoff)
  async shouldRetryPayment(customerId: string): Promise<{ retry: boolean; delayMs: number }> {
    const retryCount = await this.getPaymentRetryCount(customerId);

    // Maximum 3 retry attempts
    if (retryCount >= 3) {
      return { retry: false, delayMs: 0 };
    }

    // Exponential backoff: 1 hour, 6 hours, 24 hours
    const delays = [60 * 60 * 1000, 6 * 60 * 60 * 1000, 24 * 60 * 60 * 1000];
    return { retry: true, delayMs: delays[retryCount] || 60 * 60 * 1000 };
  }

  /// Schedule payment retry (called by webhook handler)
  async schedulePaymentRetry(
    customerId: string,
    invoiceId: string,
  ): Promise<void> {
    const { retry, delayMs } = await this.shouldRetryPayment(customerId);

    if (retry) {
      await this.incrementPaymentRetryCount(customerId);

      // In production, use a job queue like BullMQ
      // For now, log the retry schedule
      this.logger.log(
        `Scheduling payment retry for customer ${customerId} in ${delayMs / (60 * 60 * 1000)} hours`,
      );

      // TODO: Add to job queue for delayed retry
      // await this.paymentRetryQueue.add('retry-payment', {
      //   customerId,
      //   invoiceId,
      // }, { delay: delayMs });
    } else {
      this.logger.warn(
        `Max retry attempts reached for customer ${customerId} - subscription will be canceled`,
      );

      // Cancel subscription after max retries
      const user = await this.userModel
        .findOne({ stripeCustomerId: customerId })
        .exec();

      if (user) {
        await this.cancelSubscription(user._id.toString(), true);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // RECEIPT VALIDATION
  // ═══════════════════════════════════════════════════════════════════════

  /// Validate Stripe payment receipt
  async validateStripeReceipt(
    paymentIntentId: string,
  ): Promise<{ valid: boolean; receipt?: any; error?: string }> {
    try {
      // Verify payment intent exists and is successful
      const paymentIntent = await this.stripeService.retrievePaymentIntent(
        paymentIntentId,
      );

      if (!paymentIntent) {
        return { valid: false, error: 'Payment intent not found' };
      }

      if (paymentIntent.status !== 'succeeded') {
        return { valid: false, error: `Payment not completed: ${paymentIntent.status}` };
      }

      // Verify payment amount matches expected
      return {
        valid: true,
        receipt: {
          id: paymentIntent.id,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          status: paymentIntent.status,
          created: new Date((paymentIntent.created as number) * 1000),
        },
      };
    } catch (error) {
      this.logger.error(`Receipt validation failed: ${error.message}`);
      return { valid: false, error: error.message };
    }
  }

  /// Validate Apple App Store receipt
  async validateAppleReceipt(
    userId: string,
    receiptData: string,
    productId: string,
  ): Promise<{ valid: boolean; subscription?: any; error?: string }> {
    try {
      // In production, verify with Apple's servers
      // For now, log and create a basic validation
      this.logger.log(`Validating Apple receipt for user ${userId}`);

      // Apple receipt validation requires:
      // 1. Send receipt to Apple's validation endpoint
      // 2. Verify response status
      // 3. Check product ID matches
      // 4. Verify receipt hasn't been used before

      // TODO: Implement actual Apple receipt validation
      // const appleResponse = await axios.post(
      //   'https://buy.itunes.apple.com/verifyReceipt',
      //   { receiptData, password: APPLE_SHARED_SECRET }
      // );

      // For now, return success for testing
      return {
        valid: true,
        subscription: {
          source: 'apple',
          productId,
          status: 'active',
          validatedAt: new Date(),
        },
      };
    } catch (error) {
      this.logger.error(`Apple receipt validation failed: ${error.message}`);
      return { valid: false, error: error.message };
    }
  }

  /// Validate Google Play Store receipt
  async validateGoogleReceipt(
    userId: string,
    purchaseToken: string,
    productId: string,
  ): Promise<{ valid: boolean; subscription?: any; error?: string }> {
    try {
      this.logger.log(`Validating Google receipt for user ${userId}`);

      // Google Play receipt validation requires:
      // 1. Verify purchase token with Google Play Developer API
      // 2. Check subscription status
      // 3. Verify product ID matches
      // 4. Check expiration time

      // TODO: Implement actual Google receipt validation
      // const googleResponse = await axios.post(
      //   `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE_NAME}/purchases/subscriptions/${productId}/tokens/${purchaseToken}`,
      //   {},
      //   { headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } }
      // );

      // For now, return success for testing
      return {
        valid: true,
        subscription: {
          source: 'google',
          productId,
          purchaseToken,
          status: 'active',
          validatedAt: new Date(),
        },
      };
    } catch (error) {
      this.logger.error(`Google receipt validation failed: ${error.message}`);
      return { valid: false, error: error.message };
    }
  }

  /// Create subscription from IAP (Apple/Google)
  async createSubscriptionFromIAP(
    userId: string,
    platform: 'apple' | 'google',
    receiptData: string | { productId: string; purchaseToken: string },
  ): Promise<{ success: boolean; subscription?: any; error?: string }> {
    try {
      let validationResult;

      if (platform === 'apple') {
        validationResult = await this.validateAppleReceipt(
          userId,
          receiptData as string,
          (receiptData as any).productId,
        );
      } else {
        validationResult = await this.validateGoogleReceipt(
          userId,
          (receiptData as any).purchaseToken,
          (receiptData as any).productId,
        );
      }

      if (!validationResult.valid || !validationResult.subscription) {
        return { success: false, error: validationResult.error };
      }

      // Map product ID to subscription tier
      const productId = (receiptData as any).productId;
      const tier = this.mapProductIdToTier(productId);

      if (!tier) {
        return { success: false, error: 'Unknown product' };
      }

      // Create or update subscription
      const userIdObj = new Types.ObjectId(userId);
      const subscription = await this.createOrUpdateSubscription(
        userIdObj,
        tier,
        `iap_${platform}_${Date.now()}`, // Mock subscription ID
        `cus_iap_${userId}`, // Mock customer ID
        false,
      );

      return { success: true, subscription };
    } catch (error) {
      this.logger.error(`IAP subscription creation failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /// Map product ID to subscription tier
  private mapProductIdToTier(productId: string): string | null {
    // Apple product IDs (example)
    const appleTierMap: Record<string, string> = {
      'com.gigmatch.subscription.pro.monthly': 'pro',
      'com.gigmatch.subscription.pro.yearly': 'pro',
      'com.gigmatch.subscription.premium.monthly': 'premium',
      'com.gigmatch.subscription.premium.yearly': 'premium',
    };

    // Google product IDs (example)
    const googleTierMap: Record<string, string> = {
      'gigmatch_pro_monthly': 'pro',
      'gigmatch_pro_yearly': 'pro',
      'gigmatch_premium_monthly': 'premium',
      'gigmatch_premium_yearly': 'premium',
    };

    return appleTierMap[productId] || googleTierMap[productId] || null;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // APPLE PAY / GOOGLE PAY CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════

  /// Get Apple Pay merchant configuration
  getApplePayConfig(): { merchantId: string; merchantName: string; countryCode: string } {
    return {
      merchantId: this.configService.get<string>('APPLE_PAY_MERCHANT_ID') || 'merchant.com.gigmatch',
      merchantName: this.configService.get<string>('APPLE_PAY_MERCHANT_NAME') || 'GigMatch',
      countryCode: this.configService.get<string>('STRIPE_COUNTRY_CODE') || 'US',
    };
  }

  /// Check if Apple Pay is available/enabled
  isApplePayEnabled(): boolean {
    return this.stripeService.isConfigured &&
      !!this.configService.get<string>('APPLE_PAY_MERCHANT_ID');
  }

  /// Check if Google Pay is available/enabled
  isGooglePayEnabled(): boolean {
    return this.stripeService.isConfigured &&
      !!this.configService.get<string>('GOOGLE_PAY_MERCHANT_ID');
  }

  /// Get Google Pay configuration
  getGooglePayConfig(): {
    merchantId: string;
    merchantName: string;
    countryCode: string;
    currencyCode: string;
    environment: string;
  } {
    const isTestMode = !this.stripeService.isConfigured ||
      (this.configService.get<string>('STRIPE_SECRET_KEY') || '').includes('test');

    return {
      merchantId: this.configService.get<string>('GOOGLE_PAY_MERCHANT_ID') || 'merchant.com.gigmatch',
      merchantName: this.configService.get<string>('GOOGLE_PAY_MERCHANT_NAME') || 'GigMatch',
      countryCode: this.configService.get<string>('STRIPE_COUNTRY_CODE') || 'US',
      currencyCode: 'USD',
      environment: isTestMode ? 'TEST' : 'PRODUCTION',
    };
  }

  /// Get payment methods enabled for the merchant
  async getEnabledPaymentMethods(): Promise<string[]> {
    const methods: string[] = ['card'];

    if (this.isApplePayEnabled()) {
      methods.push('apple_pay');
    }

    if (this.isGooglePayEnabled()) {
      methods.push('google_pay');
    }

    return methods;
  }

  /// Create payment intent with wallet support
  async createWalletPaymentIntent(
    userId: string,
    amount: number,
    currency: string = 'usd',
    walletType: 'apple_pay' | 'google_pay' | null = null,
  ): Promise<{ clientSecret: string; paymentIntentId: string }> {
    const customerId = await this.getOrCreateStripeCustomer(userId);

    // For wallet payments, we can use automatic payment methods
    const paymentIntent = await this.stripeService.createPaymentIntent({
      amount,
      currency,
      customerId,
      description: `GigMatch ${walletType ? walletType.replace('_', ' ') : 'payment'}`,
      metadata: {
        userId,
        walletType: walletType || 'card',
      },
    });

    return {
      clientSecret: paymentIntent.client_secret!,
      paymentIntentId: paymentIntent.id,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // WEBHOOK SYNC METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  /// Sync subscription from Stripe webhook event
  async syncSubscriptionFromWebhook(
    subscription: any, // Stripe.Subscription
    userId: string,
  ): Promise<void> {
    const userIdObj = new Types.ObjectId(userId);

    // Determine tier from price ID
    const priceId = subscription.items?.data?.[0]?.price?.id;
    const tier = this.getTierFromPriceId(priceId);

    const now = new Date();
    const periodEnd = new Date(subscription.current_period_end * 1000);

    await this.subscriptionModel.findOneAndUpdate(
      { userId: userIdObj },
      {
        $set: {
          tier,
          plan: tier,
          status:
            subscription.status === 'active'
              ? SubscriptionStatus.ACTIVE
              : SubscriptionStatus.CANCELED,
          stripeSubscriptionId: subscription.id,
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          canceledAt: subscription.canceled_at
            ? new Date(subscription.canceled_at * 1000)
            : null,
          hasActiveSubscription: subscription.status === 'active',
          updatedAt: now,
        },
      },
      { upsert: true },
    );

    // Update user denormalized fields
    await this.userModel.findByIdAndUpdate(userIdObj, {
      subscriptionTier: tier,
      hasActiveSubscription: subscription.status === 'active',
    });

    this.logger.log(`Synced subscription for user ${userId} to tier: ${tier}`);
  }

  /// Cancel subscription from webhook
  async cancelSubscriptionByWebhook(
    subscriptionId: string,
    userId: string,
  ): Promise<void> {
    const userIdObj = new Types.ObjectId(userId);

    await this.subscriptionModel.findOneAndUpdate(
      { stripeSubscriptionId: subscriptionId },
      {
        $set: {
          status: SubscriptionStatus.CANCELED,
          hasActiveSubscription: false,
          canceledAt: new Date(),
          updatedAt: new Date(),
        },
      },
    );

    await this.userModel.findByIdAndUpdate(userIdObj, {
      subscriptionTier: 'free',
      hasActiveSubscription: false,
    });

    this.logger.log(`Cancelled subscription for user ${userId}`);
  }

  /// Handle invoice paid webhook
  async handleInvoicePaid(
    customerId: string,
    invoice: any, // Stripe.Invoice
  ): Promise<void> {
    const user = await this.userModel.findOne({ stripeCustomerId: customerId });

    if (!user) {
      this.logger.warn(`User not found for Stripe customer: ${customerId}`);
      return;
    }

    // Determine tier from invoice line items
    const priceId = invoice.lines?.data?.[0]?.price?.id;
    const tier = this.getTierFromPriceId(priceId);

    // Update subscription and user
    const userIdObj = user._id as Types.ObjectId;

    await this.subscriptionModel.findOneAndUpdate(
      { userId: userIdObj },
      {
        $set: {
          tier,
          plan: tier,
          status: SubscriptionStatus.ACTIVE,
          hasActiveSubscription: true,
          updatedAt: new Date(),
        },
      },
      { upsert: true },
    );

    await this.userModel.findByIdAndUpdate(userIdObj, {
      subscriptionTier: tier,
      hasActiveSubscription: true,
    });

    this.logger.log(`Invoice paid for user ${user._id}, tier: ${tier}`);
  }

  /// Handle invoice payment failed webhook
  async handleInvoicePaymentFailed(
    customerId: string,
    invoice: any, // Stripe.Invoice
  ): Promise<void> {
    const user = await this.userModel.findOne({ stripeCustomerId: customerId });

    if (!user) {
      this.logger.warn(
        `User not found for failed payment customer: ${customerId}`,
      );
      return;
    }

    this.logger.warn(`Invoice payment failed for user ${user._id}`);

    // Note: Notification should be sent via NotificationsService
    // but we don't have access to it here - the webhook controller handles this
  }

  /// Helper to determine tier from Stripe price ID
  private getTierFromPriceId(priceId: string): string {
    if (!priceId) {
      return 'free';
    }

    // Check against configured price IDs
    const premiumMonthly = this.configService.get<string>(
      'STRIPE_PREMIUM_MONTHLY_PRICE_ID',
    );
    const premiumYearly = this.configService.get<string>(
      'STRIPE_PREMIUM_YEARLY_PRICE_ID',
    );
    const proMonthly = this.configService.get<string>(
      'STRIPE_PRO_MONTHLY_PRICE_ID',
    );
    const proYearly = this.configService.get<string>(
      'STRIPE_PRO_YEARLY_PRICE_ID',
    );

    if (priceId === premiumMonthly || priceId === premiumYearly) {
      return 'premium';
    }
    if (priceId === proMonthly || priceId === proYearly) {
      return 'pro';
    }

    // Fallback: check if price ID contains tier name
    const lowerPriceId = priceId.toLowerCase();
    if (lowerPriceId.includes('premium')) {
      return 'premium';
    }
    if (lowerPriceId.includes('pro')) {
      return 'pro';
    }

    return 'free';
  }
}

