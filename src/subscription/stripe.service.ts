/// 💳 GigMatch Stripe Service - Payment Processing
///
/// Stripe integration service for handling all payment operations
/// Features:
/// - Customer management
/// - Checkout session creation
/// - Subscription management
/// - Payment intent handling
/// - Billing portal integration
/// - Webhook signature verification
/// - Payment method operations

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

export interface CreateCustomerDto {
  email: string;
  name?: string;
  phone?: string;
  metadata?: Record<string, string>;
}

export interface CreateCheckoutSessionDto {
  customerId: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}

export interface CreatePaymentIntentDto {
  amount: number;
  currency: string;
  customerId?: string;
  description?: string;
  metadata?: Record<string, string>;
}

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private stripe: Stripe;

  /// Stripe API version - update yearly for new features and security
  /// Check https://stripe.com/docs/api/versioning for latest version
  private static readonly API_VERSION = '2026-01-17.clover' as const;

  constructor(private configService: ConfigService) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');

    if (!secretKey) {
      this.logger.warn(
        'Stripe secret key not configured - payment features will be disabled',
      );
      this.stripe = new Stripe('sk_test_placeholder', {
        apiVersion: StripeService.API_VERSION,
      });
    } else {
      this.stripe = new Stripe(secretKey, {
        apiVersion: StripeService.API_VERSION,
      });
    }

    this.logger.log(`Stripe SDK initialized with API version: ${StripeService.API_VERSION}`);
  }

  /// Check if Stripe is configured
  get isConfigured(): boolean {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    return secretKey != null && !secretKey.includes('placeholder');
  }

  /// Get the configured API version
  getApiVersion(): string {
    return StripeService.API_VERSION;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // CUSTOMER MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════

  /// Create a new Stripe customer
  async createCustomer(dto: CreateCustomerDto): Promise<string> {
    if (!this.isConfigured) {
      this.logger.warn('Stripe not configured, returning mock customer ID');
      return `cus_mock_${Date.now()}`;
    }

    try {
      const customer = await this.stripe.customers.create({
        email: dto.email,
        name: dto.name,
        phone: dto.phone,
        metadata: dto.metadata,
      });

      this.logger.log(`Created Stripe customer: ${customer.id}`);
      return customer.id;
    } catch (error) {
      this.logger.error(`Failed to create customer: ${error.message}`);
      throw error;
    }
  }

  /// Get customer by ID
  async getCustomer(customerId: string): Promise<Stripe.Customer | null> {
    if (!this.isConfigured) return null;

    try {
      return (await this.stripe.customers.retrieve(
        customerId,
      )) as Stripe.Customer;
    } catch (error) {
      if (error.type === 'StripeCustomerNotFoundError') {
        return null;
      }
      throw error;
    }
  }

  /// Update customer
  async updateCustomer(
    customerId: string,
    updates: Stripe.CustomerUpdateParams,
  ): Promise<Stripe.Customer> {
    if (!this.isConfigured) {
      throw new Error('Stripe not configured');
    }

    return this.stripe.customers.update(customerId, updates);
  }

  /// Delete customer
  async deleteCustomer(customerId: string): Promise<void> {
    if (!this.isConfigured) return;

    await this.stripe.customers.del(customerId);
    this.logger.log(`Deleted Stripe customer: ${customerId}`);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // CHECKOUT SESSIONS
  // ═══════════════════════════════════════════════════════════════════════

  /// Create checkout session for subscription
  async createCheckoutSession(
    dto: CreateCheckoutSessionDto,
  ): Promise<Stripe.Checkout.Session> {
    if (!this.isConfigured) {
      return this.createMockCheckoutSession(dto);
    }

    try {
      const session = await this.stripe.checkout.sessions.create({
        customer: dto.customerId,
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [
          {
            price: dto.priceId,
            quantity: 1,
          },
        ],
        success_url: dto.successUrl,
        cancel_url: dto.cancelUrl,
        metadata: dto.metadata,
        subscription_data: {
          metadata: dto.metadata,
        },
        allow_promotion_codes: true,
        billing_address_collection: 'auto',
        customer_update: {
          address: 'auto',
          name: 'auto',
        },
      });

      this.logger.log(`Created checkout session: ${session.id}`);
      return session;
    } catch (error) {
      this.logger.error(`Failed to create checkout session: ${error.message}`);
      throw error;
    }
  }

  /// Create mock checkout session for testing
  private createMockCheckoutSession(
    dto: CreateCheckoutSessionDto,
  ): Stripe.Checkout.Session {
    return {
      id: `cs_mock_${Date.now()}`,
      object: 'checkout.session',
      customer: dto.customerId,
      mode: 'subscription',
      payment_status: 'unpaid',
      status: 'open',
      url: `https://checkout.stripe.com/mock/${dto.priceId}`,
      line_items: {
        data: [
          {
            id: `li_mock_${Date.now()}`,
            object: 'item',
            price: {
              id: dto.priceId,
              object: 'price',
            },
            quantity: 1,
          },
        ],
        has_more: false,
        total_count: 1,
        url: '',
      },
      success_url: dto.successUrl,
      cancel_url: dto.cancelUrl,
      metadata: dto.metadata || {},
      currency: 'usd',
      amount_total: 999,
      created: Date.now() / 1000,
    } as unknown as Stripe.Checkout.Session;
  }

  /// Get checkout session by ID
  async getCheckoutSession(
    sessionId: string,
  ): Promise<Stripe.Checkout.Session> {
    if (!this.isConfigured) {
      return this.getMockCheckoutSession(sessionId);
    }

    return this.stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['line_items', 'subscription'],
    });
  }

  /// Get mock checkout session for testing
  private getMockCheckoutSession(sessionId: string): Stripe.Checkout.Session {
    return {
      id: sessionId,
      object: 'checkout.session',
      customer: 'cus_mock',
      mode: 'subscription',
      payment_status: 'paid',
      status: 'complete',
      url: '',
      line_items: {
        data: [
          {
            id: 'li_mock',
            object: 'item',
            price: {
              id: 'price_pro_monthly',
              object: 'price',
            },
            quantity: 1,
          },
        ],
        has_more: false,
        total_count: 1,
        url: '',
      },
      success_url: 'https://app.gigmatch.com/success',
      cancel_url: 'https://app.gigmatch.com/cancel',
      metadata: {
        userId: 'user123',
        isYearly: 'false',
      },
      currency: 'usd',
      amount_total: 999,
      created: Date.now() / 1000,
      subscription: 'sub_mock',
      invoice: 'in_mock',
      payment_intent: 'pi_mock',
    } as unknown as Stripe.Checkout.Session;
  }

  /// Retrieve checkout session with line items
  async getCheckoutSessionWithLineItems(
    sessionId: string,
  ): Promise<Stripe.Checkout.Session> {
    return this.stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['line_items', 'line_items.data.price.product'],
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // SUBSCRIPTION MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════

  /// Create a new subscription
  async createSubscription(
    customerId: string,
    priceId: string,
    metadata?: Record<string, string>,
  ): Promise<Stripe.Subscription> {
    if (!this.isConfigured) {
      return this.createMockSubscription(customerId, priceId);
    }

    try {
      const subscription = await this.stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        payment_behavior: 'default_incomplete',
        expand: ['latest_invoice.payment_intent'],
        metadata,
      });

      this.logger.log(`Created subscription: ${subscription.id}`);
      return subscription;
    } catch (error) {
      this.logger.error(`Failed to create subscription: ${error.message}`);
      throw error;
    }
  }

  /// Create mock subscription for testing
  private createMockSubscription(
    customerId: string,
    priceId: string,
  ): Stripe.Subscription {
    return {
      id: `sub_mock_${Date.now()}`,
      object: 'subscription',
      customer: customerId,
      status: 'active',
      current_period_start: Date.now() / 1000,
      current_period_end: Date.now() / 1000 + 30 * 24 * 60 * 60,
      cancel_at_period_end: false,
      canceled_at: null,
      items: {
        data: [
          {
            id: `si_mock_${Date.now()}`,
            object: 'subscription_item',
            price: {
              id: priceId,
              object: 'price',
            },
          },
        ],
      },
      metadata: {},
      created: Date.now() / 1000,
    } as unknown as Stripe.Subscription;
  }

  /// Get subscription by ID
  async getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    if (!this.isConfigured) {
      return this.getMockSubscription(subscriptionId);
    }

    return this.stripe.subscriptions.retrieve(subscriptionId);
  }

  /// Get mock subscription for testing
  private getMockSubscription(subscriptionId: string): Stripe.Subscription {
    return {
      id: subscriptionId,
      object: 'subscription',
      customer: 'cus_mock',
      status: 'active',
      current_period_start: Date.now() / 1000,
      current_period_end: Date.now() / 1000 + 30 * 24 * 60 * 60,
      cancel_at_period_end: false,
      canceled_at: null,
      items: {
        data: [
          {
            id: 'si_mock',
            object: 'subscription_item',
            price: {
              id: 'price_pro_monthly',
              object: 'price',
            },
          },
        ],
      },
      metadata: {},
      created: Date.now() / 1000,
    } as unknown as Stripe.Subscription;
  }

  /// Update subscription (upgrade/downgrade)
  async updateSubscription(
    subscriptionId: string,
    newPriceId: string,
  ): Promise<Stripe.Subscription> {
    if (!this.isConfigured) {
      return this.getMockSubscription(subscriptionId);
    }

    try {
      const subscription =
        await this.stripe.subscriptions.retrieve(subscriptionId);

      const updatedSubscription = await this.stripe.subscriptions.update(
        subscriptionId,
        {
          items: [
            {
              id: subscription.items.data[0].id,
              price: newPriceId,
            },
          ],
          proration_behavior: 'create_prorations',
        },
      );

      this.logger.log(`Updated subscription: ${subscriptionId}`);
      return updatedSubscription;
    } catch (error) {
      this.logger.error(`Failed to update subscription: ${error.message}`);
      throw error;
    }
  }

  /// Cancel subscription
  async cancelSubscription(
    subscriptionId: string,
    immediately: boolean = false,
  ): Promise<Stripe.Subscription> {
    if (!this.isConfigured) {
      return this.getMockSubscription(subscriptionId);
    }

    try {
      if (immediately) {
        return await this.stripe.subscriptions.cancel(subscriptionId);
      } else {
        return await this.stripe.subscriptions.update(subscriptionId, {
          cancel_at_period_end: true,
        });
      }
    } catch (error) {
      this.logger.error(`Failed to cancel subscription: ${error.message}`);
      throw error;
    }
  }

  /// Resume a canceled subscription
  async resumeSubscription(
    subscriptionId: string,
  ): Promise<Stripe.Subscription> {
    if (!this.isConfigured) {
      return this.getMockSubscription(subscriptionId);
    }

    return this.stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false,
    });
  }

  /// Pause subscription
  async pauseSubscription(
    subscriptionId: string,
    resumeBehavior: 'void' | 'mark_uncollectible' = 'void',
  ): Promise<Stripe.Subscription> {
    if (!this.isConfigured) {
      return this.getMockSubscription(subscriptionId);
    }

    return this.stripe.subscriptions.update(subscriptionId, {
      pause_collection: {
        behavior: resumeBehavior,
      },
    });
  }

  /// Resume paused subscription
  async resumePausedSubscription(
    subscriptionId: string,
  ): Promise<Stripe.Subscription> {
    if (!this.isConfigured) {
      return this.getMockSubscription(subscriptionId);
    }

    return this.stripe.subscriptions.update(subscriptionId, {
      pause_collection: '',
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // EPHEMERAL KEYS (for Payment Sheet)
  // ═══════════════════════════════════════════════════════════════════════

  /// Create an ephemeral key for the customer (used by Payment Sheet)
  async createEphemeralKey(customerId: string): Promise<string | null> {
    if (!this.isConfigured) {
      return `ek_mock_${Date.now()}`;
    }

    try {
      const ephemeralKey = await this.stripe.ephemeralKeys.create(
        { customer: customerId },
        { apiVersion: '2025-12-15.clover' },
      );

      this.logger.log(`Created ephemeral key for customer: ${customerId}`);
      return ephemeralKey.secret ?? null;
    } catch (error) {
      this.logger.error(`Failed to create ephemeral key: ${error.message}`);
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PAYMENT INTENTS
  // ═══════════════════════════════════════════════════════════════════════

  /// Create a payment intent
  async createPaymentIntent(
    dto: CreatePaymentIntentDto,
  ): Promise<Stripe.PaymentIntent> {
    if (!this.isConfigured) {
      return this.createMockPaymentIntent(dto);
    }

    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: dto.amount,
        currency: dto.currency,
        customer: dto.customerId,
        description: dto.description,
        metadata: dto.metadata,
        automatic_payment_methods: {
          enabled: true,
        },
      });

      this.logger.log(`Created payment intent: ${paymentIntent.id}`);
      return paymentIntent;
    } catch (error) {
      this.logger.error(`Failed to create payment intent: ${error.message}`);
      throw error;
    }
  }

  /// Create mock payment intent for testing
  private createMockPaymentIntent(
    dto: CreatePaymentIntentDto,
  ): Stripe.PaymentIntent {
    const mockId = `pi_mock_${Date.now()}`;
    return {
      id: mockId,
      object: 'payment_intent',
      amount: dto.amount,
      currency: dto.currency,
      status: 'requires_payment_method',
      customer: dto.customerId,
      description: dto.description,
      metadata: dto.metadata || {},
      created: Date.now() / 1000,
      client_secret: `${mockId}_secret_mock`, // ✅ Required for Payment Sheet
    } as unknown as Stripe.PaymentIntent;
  }

  /// Confirm payment intent
  async confirmPaymentIntent(
    paymentIntentId: string,
    paymentMethodId: string,
  ): Promise<Stripe.PaymentIntent> {
    if (!this.isConfigured) {
      return this.createMockPaymentIntent({ amount: 0, currency: 'usd' });
    }

    return this.stripe.paymentIntents.confirm(paymentIntentId, {
      payment_method: paymentMethodId,
    });
  }

  /// Cancel payment intent
  async cancelPaymentIntent(
    paymentIntentId: string,
  ): Promise<Stripe.PaymentIntent> {
    if (!this.isConfigured) {
      return this.createMockPaymentIntent({ amount: 0, currency: 'usd' });
    }

    return this.stripe.paymentIntents.cancel(paymentIntentId);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PAYMENT METHODS
  // ═══════════════════════════════════════════════════════════════════════

  /// Attach payment method to customer
  async attachPaymentMethod(
    paymentMethodId: string,
    customerId: string,
  ): Promise<Stripe.PaymentMethod> {
    if (!this.isConfigured) {
      return this.createMockPaymentMethod(paymentMethodId);
    }

    const paymentMethod = await this.stripe.paymentMethods.attach(
      paymentMethodId,
      { customer: customerId },
    );

    this.logger.log(
      `Attached payment method ${paymentMethodId} to customer ${customerId}`,
    );
    return paymentMethod;
  }

  /// Create mock payment method for testing
  private createMockPaymentMethod(
    paymentMethodId: string,
  ): Stripe.PaymentMethod {
    return {
      id: paymentMethodId,
      object: 'payment_method',
      type: 'card',
      card: {
        brand: 'visa',
        last4: '4242',
        exp_month: 12,
        exp_year: 2025,
        funding: 'credit',
      },
      created: Date.now() / 1000,
    } as unknown as Stripe.PaymentMethod;
  }

  /// Detach payment method
  async detachPaymentMethod(
    paymentMethodId: string,
  ): Promise<Stripe.PaymentMethod> {
    if (!this.isConfigured) {
      return this.createMockPaymentMethod(paymentMethodId);
    }

    return this.stripe.paymentMethods.detach(paymentMethodId);
  }

  /// Get payment method by ID
  async getPaymentMethod(
    paymentMethodId: string,
  ): Promise<Stripe.PaymentMethod | null> {
    if (!this.isConfigured) {
      return this.createMockPaymentMethod(paymentMethodId);
    }

    try {
      return await this.stripe.paymentMethods.retrieve(paymentMethodId);
    } catch (error) {
      if (error.type === 'StripeResourceNotFound') {
        return null;
      }
      throw error;
    }
  }

  /// Set default payment method for customer
  async setDefaultPaymentMethod(
    customerId: string,
    paymentMethodId: string,
  ): Promise<Stripe.Customer> {
    if (!this.isConfigured) {
      return {
        id: customerId,
        object: 'customer',
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      } as unknown as Stripe.Customer;
    }

    return this.stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });
  }

  /// List customer's payment methods
  async listPaymentMethods(
    customerId: string,
    type: Stripe.PaymentMethodListParams.Type = 'card',
  ): Promise<Stripe.PaymentMethod[]> {
    if (!this.isConfigured) {
      return [this.createMockPaymentMethod('pm_mock')];
    }

    const paymentMethods = await this.stripe.paymentMethods.list({
      customer: customerId,
      type,
    });

    return paymentMethods.data;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // BILLING PORTAL
  // ═══════════════════════════════════════════════════════════════════════

  /// Create billing portal session
  async createBillingPortalSession(
    customerId: string,
    returnUrl: string,
  ): Promise<{ url: string }> {
    if (!this.isConfigured) {
      return {
        url: `https://billing.stripe.com/mock/${customerId}?return=${encodeURIComponent(returnUrl)}`,
      };
    }

    try {
      const session = await this.stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl,
      });

      this.logger.log(
        `Created billing portal session for customer: ${customerId}`,
      );
      return { url: session.url };
    } catch (error) {
      this.logger.error(
        `Failed to create billing portal session: ${error.message}`,
      );
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PRODUCTS AND PRICES
  // ═══════════════════════════════════════════════════════════════════════

  /// Create a product
  async createProduct(
    name: string,
    description?: string,
    metadata?: Record<string, string>,
  ): Promise<Stripe.Product> {
    if (!this.isConfigured) {
      return {
        id: `prod_mock_${Date.now()}`,
        object: 'product',
        name,
        description,
        metadata,
      } as unknown as Stripe.Product;
    }

    return this.stripe.products.create({
      name,
      description,
      metadata,
    });
  }

  /// Create a price for a product
  async createPrice(
    productId: string,
    unitAmount: number,
    currency: string,
    recurring: { interval: 'month' | 'year' },
    metadata?: Record<string, string>,
  ): Promise<Stripe.Price> {
    if (!this.isConfigured) {
      return {
        id: `price_mock_${Date.now()}`,
        object: 'price',
        product: productId,
        unit_amount: unitAmount,
        currency,
        recurring,
        metadata,
      } as unknown as Stripe.Price;
    }

    return this.stripe.prices.create({
      product: productId,
      unit_amount: unitAmount,
      currency,
      recurring,
      metadata,
    });
  }

  /// List all prices for a product
  async listPrices(productId: string): Promise<Stripe.Price[]> {
    if (!this.isConfigured) {
      return [];
    }

    const prices = await this.stripe.prices.list({
      product: productId,
      active: true,
    });

    return prices.data;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // INVOICES
  // ═══════════════════════════════════════════════════════════════════════

  /// Get invoice by ID
  async getInvoice(invoiceId: string): Promise<Stripe.Invoice | null> {
    if (!this.isConfigured) {
      return {
        id: invoiceId,
        object: 'invoice',
        status: 'paid',
        amount_paid: 999,
        currency: 'usd',
      } as unknown as Stripe.Invoice;
    }

    try {
      return await this.stripe.invoices.retrieve(invoiceId);
    } catch (error) {
      if (error.type === 'StripeResourceNotFound') {
        return null;
      }
      throw error;
    }
  }

  /// List customer invoices
  async listInvoices(
    customerId: string,
    limit: number = 10,
  ): Promise<Stripe.Invoice[]> {
    if (!this.isConfigured) {
      return [];
    }

    const invoices = await this.stripe.invoices.list({
      customer: customerId,
      limit,
    });

    return invoices.data;
  }

  /// Finalize invoice
  async finalizeInvoice(invoiceId: string): Promise<Stripe.Invoice> {
    if (!this.isConfigured) {
      const invoice = await this.getInvoice(invoiceId);
      return invoice!;
    }

    return this.stripe.invoices.finalizeInvoice(invoiceId);
  }

  /// Pay invoice
  async payInvoice(invoiceId: string): Promise<Stripe.Invoice> {
    if (!this.isConfigured) {
      const invoice = await this.getInvoice(invoiceId);
      return invoice!;
    }

    return this.stripe.invoices.pay(invoiceId);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // WEBHOOK HANDLING
  // ═══════════════════════════════════════════════════════════════════════

  /// Verify webhook signature
  verifyWebhookSignature(payload: Buffer, signature: string): Stripe.Event {
    if (!this.isConfigured) {
      const event = JSON.parse(payload.toString());
      return {
        type: event.type || 'unknown',
        data: { object: event },
      } as Stripe.Event;
    }

    const webhookSecret = this.configService.get<string>(
      'STRIPE_WEBHOOK_SECRET',
    );

    if (!webhookSecret) {
      throw new Error('Stripe webhook secret not configured');
    }

    return this.stripe.webhooks.constructEvent(
      payload,
      signature,
      webhookSecret,
    );
  }

  /// Construct webhook event from raw body
  constructEvent(payload: Buffer, signature: string): Stripe.Event {
    const webhookSecret = this.configService.get<string>(
      'STRIPE_WEBHOOK_SECRET',
    );

    if (!webhookSecret || !this.isConfigured) {
      const event = JSON.parse(payload.toString());
      return {
        type: event.type || 'unknown',
        data: { object: event },
      } as Stripe.Event;
    }

    return this.stripe.webhooks.constructEvent(
      payload,
      signature,
      webhookSecret,
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // REFUNDS
  // ═══════════════════════════════════════════════════════════════════════

  /// Create a refund
  async createRefund(
    paymentIntentId: string,
    amount?: number,
    reason?: Stripe.RefundCreateParams.Reason,
  ): Promise<Stripe.Refund> {
    if (!this.isConfigured) {
      return {
        id: `re_mock_${Date.now()}`,
        object: 'refund',
        amount: amount || 0,
        payment_intent: paymentIntentId,
        status: 'succeeded',
      } as unknown as Stripe.Refund;
    }

    return this.stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount,
      reason,
    });
  }

  /// Cancel a refund
  async cancelRefund(refundId: string): Promise<Stripe.Refund> {
    if (!this.isConfigured) {
      return {
        id: refundId,
        object: 'refund',
        status: 'canceled',
      } as unknown as Stripe.Refund;
    }

    return this.stripe.refunds.cancel(refundId);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // COUPONS AND PROMOTIONS
  // ═══════════════════════════════════════════════════════════════════════

  /// Create a coupon
  async createCoupon(dto: Stripe.CouponCreateParams): Promise<Stripe.Coupon> {
    if (!this.isConfigured) {
      return {
        id: `cp_mock_${Date.now()}`,
        object: 'coupon',
        duration: dto.duration || 'once',
        duration_in_months: dto.duration_in_months,
        percent_off: dto.percent_off,
        amount_off: dto.amount_off,
        currency: dto.currency,
      } as unknown as Stripe.Coupon;
    }

    return this.stripe.coupons.create(dto);
  }

  /// Get coupon by ID
  async getCoupon(couponId: string): Promise<Stripe.Coupon | null> {
    if (!this.isConfigured) {
      return {
        id: couponId,
        object: 'coupon',
        valid: true,
      } as unknown as Stripe.Coupon;
    }

    try {
      return await this.stripe.coupons.retrieve(couponId);
    } catch (error) {
      return null;
    }
  }

  /// List active coupons
  async listCoupons(): Promise<Stripe.Coupon[]> {
    if (!this.isConfigured) {
      return [];
    }

    const coupons = await this.stripe.coupons.list();
    return coupons.data.filter((coupon) => (coupon as any).active);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // HELPER METHODS
  // ═══════════════════════════════════════════════════════════════════════

  /// Format amount for Stripe (convert from dollars to cents)
  static formatAmountForStripe(amount: number): number {
    return Math.round(amount * 100);
  }

  /// Format amount from Stripe (convert from cents to dollars)
  static formatAmountFromStripe(amountInCents: number): number {
    return amountInCents / 100;
  }

  /// Get publishable key for client
  getPublishableKey(): string {
    return (
      this.configService.get<string>('STRIPE_PUBLISHABLE_KEY') ||
      'pk_test_placeholder'
    );
  }

  /// Check if a price ID is for yearly billing
  isYearlyPrice(priceId: string): boolean {
    return priceId.includes('yearly') || priceId.includes('year');
  }

  /// Get price interval from price ID
  getPriceInterval(priceId: string): 'monthly' | 'yearly' {
    return this.isYearlyPrice(priceId) ? 'yearly' : 'monthly';
  }
}
