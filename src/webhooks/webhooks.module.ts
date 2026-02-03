import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StripeWebhookController } from './stripe.webhook';
import { BookingsModule } from '../bookings/bookings.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [ConfigModule, BookingsModule, NotificationsModule],
  controllers: [StripeWebhookController],
})
export class WebhooksModule {}
