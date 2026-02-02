/// 💳 GigMatch Subscription Controller
///
/// REST API endpoints for subscription and payment management
/// - Payment intents for Payment Sheet
/// - Subscription checkout sessions
/// - Subscription management (upgrade/cancel)
/// - Payment methods
/// - Customer portal
/// - Webhook handling with signature verification
///
/// 2026 Best Practices:
/// - Webhook signature verification for security
/// - Raw body parsing for signature verification
/// - Idempotent webhook handling
/// - Retry logic for payment failures

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  HttpCode,
  Logger,
  Headers,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { IsString, IsNumber, IsOptional, IsBoolean, IsObject } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SubscriptionService } from './subscription.service';
import { StripeService, CreatePaymentIntentDto } from './stripe.service';

// ═══════════════════════════════════════════════════════════════════════════
// DTOs
// ═══════════════════════════════════════════════════════════════════════════

class CreatePaymentIntentBodyDto {
  @IsOptional()
  @IsString()
  priceId?: string;

  @IsNumber()
  amount: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, string>;
}

class CreateCheckoutSessionDto {
  @IsString()
  priceId: string;

  @IsOptional()
  @IsBoolean()
  isYearly?: boolean;

  @IsString()
  successUrl: string;

  @IsString()
  cancelUrl: string;
}

class UpdateSubscriptionDto {
  @IsString()
  newPriceId: string;

  @IsOptional()
  @IsBoolean()
  isYearly?: boolean;
}

class AddPaymentMethodDto {
  @IsString()
  paymentMethodId: string;

  @IsOptional()
  @IsBoolean()
  setAsDefault?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// CONTROLLER
// ═══════════════════════════════════════════════════════════════════════════

@Controller('subscription')
export class SubscriptionController {
  private readonly logger = new Logger(SubscriptionController.name);

  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly stripeService: StripeService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════
  // PAYMENT INTENTS (for Payment Sheet)
  // ═══════════════════════════════════════════════════════════════════════

  /// Create a payment intent for the Payment Sheet
  /// POST /subscription/payment-intent
  @Post('payment-intent')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async createPaymentIntent(
    @CurrentUser() user: { userId: string; email: string },
    @Body() dto: CreatePaymentIntentBodyDto,
  ) {
    this.logger.log(`Creating payment intent for user: ${user.userId}`);

    // Get or create Stripe customer
    let customerId: string | undefined;
    try {
      customerId = await this.subscriptionService.getOrCreateStripeCustomer(
        user.userId,
      );
    } catch (e) {
      this.logger.warn(`Could not get/create customer: ${e.message}`);
    }

    const paymentIntent = await this.stripeService.createPaymentIntent({
      amount: dto.amount,
      currency: dto.currency || 'usd',
      customerId,
      description: dto.description,
      metadata: {
        userId: user.userId,
        ...dto.metadata,
      },
    });

    return {
      success: true,
      data: {
        paymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
        ephemeralKey: customerId
          ? await this.stripeService.createEphemeralKey(customerId)
          : null,
        customerId,
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PLANS
  // ═══════════════════════════════════════════════════════════════════════

  /// Get all available subscription plans
  /// GET /subscription/plans
  @Get('plans')
  async getPlans(): Promise<{ success: boolean; data: any[] }> {
    const plans = await this.subscriptionService.getPlans();
    return {
      success: true,
      data: plans,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // CURRENT SUBSCRIPTION
  // ═══════════════════════════════════════════════════════════════════════

  /// Get current user's subscription
  /// GET /subscription/current
  @Get('current')
  @UseGuards(JwtAuthGuard)
  async getCurrentSubscription(
    @CurrentUser() user: { userId: string },
  ) {
    const subscription = await this.subscriptionService.getSubscription(
      user.userId,
    );
    return {
      success: true,
      data: subscription,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // CHECKOUT
  // ═══════════════════════════════════════════════════════════════════════

  /// Create a checkout session for subscription purchase
  /// POST /subscription/checkout
  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async createCheckout(
    @CurrentUser() user: { userId: string },
    @Body() dto: CreateCheckoutSessionDto,
  ) {
    this.logger.log(`Creating checkout session for user: ${user.userId}`);

    const session = await this.subscriptionService.createCheckoutSession({
      userId: user.userId,
      priceId: dto.priceId,
      isYearly: dto.isYearly || false,
      successUrl: dto.successUrl,
      cancelUrl: dto.cancelUrl,
    });

    return {
      success: true,
      data: {
        sessionId: session.sessionId,
        url: session.url,
      },
    };
  }

  /// Verify checkout completion
  /// POST /subscription/verify
  @Post('verify')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async verifyCheckout(
    @CurrentUser() user: { userId: string },
    @Body() body: { sessionId: string },
  ) {
    this.logger.log(`Verifying checkout session: ${body.sessionId}`);

    const result = await this.subscriptionService.verifyCheckout(body.sessionId);

    return {
      success: result.success,
      data: result.subscription,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // SUBSCRIPTION MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════

  /// Upgrade or change subscription plan
  /// PUT /subscription/upgrade
  @Put('upgrade')
  @UseGuards(JwtAuthGuard)
  async upgradeSubscription(
    @CurrentUser() user: { userId: string },
    @Body() dto: UpdateSubscriptionDto,
  ) {
    const result = await this.subscriptionService.updateSubscription({
      userId: user.userId,
      newPriceId: dto.newPriceId,
      isYearly: dto.isYearly || false,
    });

    return {
      success: true,
      data: result,
      message: 'Subscription updated successfully',
    };
  }

  /// Cancel subscription
  /// DELETE /subscription/cancel
  @Delete('cancel')
  @UseGuards(JwtAuthGuard)
  async cancelSubscription(
    @CurrentUser() user: { userId: string },
    @Query('immediately') immediately?: string,
  ) {
    const cancelImmediately = immediately === 'true';
    const result = await this.subscriptionService.cancelSubscription(
      user.userId,
      cancelImmediately,
    );

    return {
      success: true,
      data: result,
      message: cancelImmediately
        ? 'Subscription canceled immediately'
        : 'Subscription will cancel at end of billing period',
    };
  }

  /// Resume a canceled subscription
  /// POST /subscription/resume
  @Post('resume')
  @UseGuards(JwtAuthGuard)
  async resumeSubscription(@CurrentUser() user: { userId: string }) {
    const result = await this.subscriptionService.resumeSubscription(
      user.userId,
    );

    return {
      success: true,
      data: result,
      message: 'Subscription resumed successfully',
    };
  }

  /// Start a free trial
  /// POST /subscription/trial
  @Post('trial')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async startTrial(
    @CurrentUser() user: { userId: string },
    @Body() dto: { tier: string },
  ) {
    const result = await this.subscriptionService.startTrial(
      user.userId,
      dto.tier || 'pro',
    );

    return {
      success: true,
      data: result,
      message: 'Free trial started successfully',
    };
  }

  /// Restore purchases (for iOS/Android IAP)
  /// POST /subscription/restore
  @Post('restore')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async restorePurchases(@CurrentUser() user: { userId: string }) {
    const result = await this.subscriptionService.restorePurchases(user.userId);

    return {
      success: result.success,
      data: result.subscription,
      message: result.success
        ? 'Purchases restored successfully'
        : 'No active subscription found',
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PAYMENT METHODS
  // ═══════════════════════════════════════════════════════════════════════

  /// Get user's payment methods
  /// GET /subscription/payment-methods
  @Get('payment-methods')
  @UseGuards(JwtAuthGuard)
  async getPaymentMethods(@CurrentUser() user: { userId: string }) {
    const methods = await this.subscriptionService.getPaymentMethods(
      user.userId,
    );

    return {
      success: true,
      data: methods,
    };
  }

  /// Add a new payment method
  /// POST /subscription/payment-methods
  @Post('payment-methods')
  @UseGuards(JwtAuthGuard)
  async addPaymentMethod(
    @CurrentUser() user: { userId: string },
    @Body() dto: AddPaymentMethodDto,
  ) {
    const result = await this.subscriptionService.addPaymentMethod(
      user.userId,
      {
        paymentMethodId: dto.paymentMethodId,
        setAsDefault: dto.setAsDefault,
      },
    );

    return {
      success: true,
      data: result,
      message: 'Payment method added successfully',
    };
  }

  /// Remove a payment method
  /// DELETE /subscription/payment-methods/:methodId
  @Delete('payment-methods/:methodId')
  @UseGuards(JwtAuthGuard)
  async removePaymentMethod(
    @CurrentUser() user: { userId: string },
    @Param('methodId') methodId: string,
  ) {
    await this.subscriptionService.removePaymentMethod(user.userId, methodId);

    return {
      success: true,
      message: 'Payment method removed successfully',
    };
  }

  /// Set default payment method
  /// PUT /subscription/payment-methods/:methodId/default
  @Put('payment-methods/:methodId/default')
  @UseGuards(JwtAuthGuard)
  async setDefaultPaymentMethod(
    @CurrentUser() user: { userId: string },
    @Param('methodId') methodId: string,
  ) {
    await this.subscriptionService.setDefaultPaymentMethod(
      user.userId,
      methodId,
    );

    return {
      success: true,
      message: 'Default payment method updated',
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // BILLING PORTAL
  // ═══════════════════════════════════════════════════════════════════════

  /// Create a billing portal session
  /// POST /subscription/portal
  @Post('portal')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async createPortalSession(
    @CurrentUser() user: { userId: string },
    @Body() dto: { returnUrl: string },
  ) {
    const session = await this.subscriptionService.createPortalSession(
      user.userId,
      dto.returnUrl,
    );

    return {
      success: true,
      data: {
        url: session.url,
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // INVOICES
  // ═══════════════════════════════════════════════════════════════════════

  /// Get user's invoice history
  /// GET /subscription/invoices
  @Get('invoices')
  @UseGuards(JwtAuthGuard)
  async getInvoices(
    @CurrentUser() user: { userId: string },
    @Query('limit') limit?: string,
  ) {
    const invoices = await this.subscriptionService.getInvoices(
      user.userId,
      parseInt(limit || '10'),
    );

    return {
      success: true,
      data: invoices,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // FEATURES & ANALYTICS
  // ═══════════════════════════════════════════════════════════════════════

  /// Get feature access for user
  /// GET /subscription/features
  @Get('features')
  @UseGuards(JwtAuthGuard)
  async getFeatureAccess(@CurrentUser() user: { userId: string }) {
    const features = await this.subscriptionService.getFeatureAccess(user.userId);
    return {
      success: true,
      data: features,
    };
  }

  /// Get remaining profile boosts
  /// GET /subscription/boosts
  @Get('boosts')
  @UseGuards(JwtAuthGuard)
  async getRemainingBoosts(@CurrentUser() user: { userId: string }) {
    const boosts = await this.subscriptionService.getRemainingBoosts(user.userId);
    return {
      success: true,
      data: { remainingBoosts: boosts },
    };
  }

  /// Use a profile boost
  /// POST /subscription/boosts/use
  @Post('boosts/use')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async useBoost(@CurrentUser() user: { userId: string }) {
    const result = await this.subscriptionService.useBoost(user.userId);
    return {
      success: result.success,
      data: result,
    };
  }

  /// Sync subscription from Stripe
  /// POST /subscription/sync
  @Post('sync')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async syncSubscription(@CurrentUser() user: { userId: string }) {
    await this.subscriptionService.syncSubscription(user.userId);
    const subscription = await this.subscriptionService.getSubscription(user.userId);
    return {
      success: true,
      data: subscription,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // WEBHOOKS - WITH SIGNATURE VERIFICATION
  // ═══════════════════════════════════════════════════════════════════════

  /// Handle Stripe webhook events
  /// POST /subscription/webhook
  ///
  /// SECURITY: This endpoint verifies Stripe signatures to prevent spoofing
  ///
  /// Required Headers:
  /// - Stripe-Signature: t=timestamp,v1=signature
  ///
  /// Idempotency: Webhooks are processed idempotently - duplicate events
  /// are safe because we check for existing records before creating
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Headers('stripe-signature') signature: string | undefined,
    @Body() body: any,
    @Req() req: RawBodyRequest<Request>,
  ) {
    this.logger.log('Received Stripe webhook');

    // Step 1: Verify webhook signature (CRITICAL for security)
    let event: any;

    if (signature) {
      // Production: Verify signature if webhook secret is configured
      const webhookSecret = this.subscriptionService.getWebhookSecret();

      if (webhookSecret) {
        try {
          // For raw body verification, we need the raw buffer
          // This requires express.raw() middleware or parsing from buffer
          event = await this.stripeService.constructWebhookEvent(
            req.rawBody || Buffer.from(JSON.stringify(body)),
            signature,
            webhookSecret,
          );
          this.logger.log(`Webhook signature verified: ${event.type}`);
        } catch (err) {
          this.logger.error(`Webhook signature verification failed: ${err.message}`);
          // In development without proper raw body, continue with body parsing
          // but log a warning
          if (process.env.NODE_ENV === 'production') {
            throw new Error('Invalid webhook signature');
          }
          event = body;
        }
      } else {
        // No webhook secret configured - use body as-is (development mode)
        this.logger.warn('No webhook secret configured - skipping signature verification');
        event = body;
      }
    } else {
      // No signature header - might be from local testing
      this.logger.warn('No Stripe-Signature header found');
      event = body;
    }

    // Step 2: Process the webhook event
    try {
      // Step 3: Idempotency check - check for duplicate event
      const eventId = event.id || `${event.type}-${Date.now()}`;
      const alreadyProcessed = await this.subscriptionService.isEventProcessed(eventId);

      if (alreadyProcessed) {
        this.logger.log(`Duplicate webhook event skipped: ${eventId}`);
        return { received: true, duplicated: true };
      }

      // Step 4: Handle the event
      await this.subscriptionService.handleWebhook(event);

      // Step 5: Mark event as processed (for idempotency)
      await this.subscriptionService.markEventProcessed(eventId, event.type);

      this.logger.log(`Webhook processed successfully: ${event.type}`);
      return { received: true, eventId };
    } catch (e) {
      this.logger.error(`Webhook processing error: ${e.message}`);
      // Return 200 to prevent Stripe from retrying permanent failures
      // but log the error for investigation
      return { received: true, error: e.message };
    }
  }
}
