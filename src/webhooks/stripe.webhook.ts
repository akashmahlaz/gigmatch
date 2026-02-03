/// 💳 Stripe Webhook Handler
///
/// Handles payment events from Stripe
import {
  Controller,
  Post,
  Headers,
  HttpCode,
  Req,
  Logger,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { BookingsService } from '../bookings/bookings.service';
import { NotificationsService } from '../notifications/notifications.service';

@Controller('webhooks')
export class StripeWebhookController {
  private readonly logger = new Logger(StripeWebhookController.name);
  private stripe: Stripe | null = null;
  private webhookSecret: string | undefined;

  constructor(
    private readonly bookingsService: BookingsService,
    private readonly notificationsService: NotificationsService,
    private readonly configService: ConfigService,
  ) {
    const stripeKey = this.configService.get<string>('stripe.secretKey');
    this.webhookSecret = this.configService.get<string>('stripe.webhookSecret');

    if (stripeKey) {
      this.stripe = new Stripe(stripeKey, {
        apiVersion: '2025-12-15.clover',
      });
    }
  }

  @Post('stripe')
  @HttpCode(200)
  async handleStripeWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() req: RawBodyRequest<Request>,
  ) {
    if (!this.stripe || !this.webhookSecret) {
      this.logger.warn('Stripe not configured');
      return { received: true, warning: 'Stripe not configured' };
    }

    let event: Stripe.Event;

    try {
      // Verify webhook signature
      const rawBody = req.rawBody;
      if (!rawBody) {
        this.logger.error('No raw body available');
        return { error: 'No raw body' };
      }

      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        this.webhookSecret,
      );
    } catch (err) {
      this.logger.error(`Webhook signature verification failed: ${err}`);
      return { error: 'Invalid signature' };
    }

    // Handle the event
    try {
      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentSucceeded(
            event.data.object as Stripe.PaymentIntent,
          );
          break;

        case 'payment_intent.payment_failed':
          await this.handlePaymentFailed(
            event.data.object as Stripe.PaymentIntent,
          );
          break;

        case 'charge.refunded':
          await this.handleRefund(event.data.object as Stripe.Charge);
          break;

        default:
          this.logger.log(`Unhandled event type: ${event.type}`);
      }
    } catch (err) {
      this.logger.error(`Error handling webhook event: ${err}`);
      // Still return 200 to acknowledge receipt
    }

    return { received: true };
  }

  private async handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent) {
    const bookingId = paymentIntent.metadata?.bookingId;
    const paymentType = paymentIntent.metadata?.type; // 'deposit' or 'final'

    if (!bookingId || !paymentType) {
      this.logger.warn('Missing metadata in payment intent');
      return;
    }

    this.logger.log(
      `Payment succeeded for booking ${bookingId}, type: ${paymentType}`,
    );

    try {
      if (paymentType === 'deposit') {
        await this.bookingsService.confirmDepositPayment(
          bookingId,
          paymentIntent.id,
        );
      } else if (paymentType === 'final') {
        await this.bookingsService.confirmFinalPayment(
          bookingId,
          paymentIntent.id,
        );
      }
    } catch (err) {
      this.logger.error(`Failed to confirm payment: ${err}`);
    }
  }

  private async handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
    const bookingId = paymentIntent.metadata?.bookingId;

    if (!bookingId) {
      return;
    }

    this.logger.warn(`Payment failed for booking ${bookingId}`);

    try {
      const booking = await this.bookingsService.findById(bookingId);

      // Notify venue about failed payment
      await this.notificationsService.sendNotification({
        userId: booking.venueUser.toString(),
        type: 'payment_failed',
        title: 'Payment Failed',
        body: `Payment for "${booking.title}" failed. Please try again.`,
        deepLink: `/booking/${bookingId}`,
      });
    } catch (err) {
      this.logger.error(`Failed to handle payment failure: ${err}`);
    }
  }

  private async handleRefund(charge: Stripe.Charge) {
    this.logger.log(`Refund processed for charge: ${charge.id}`);
    // Handle partial/full refund - can be extended based on requirements
  }
}
