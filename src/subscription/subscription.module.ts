/// 💰 GigMatch Subscription Module
///
/// Handles all subscription and payment-related functionality

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';

import { SubscriptionController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';
import { StripeService } from './stripe.service';
import { FeatureCheckService } from './feature-check.service';

import { User, UserSchema } from '../schemas/user.schema';
import {
  Subscription,
  SubscriptionSchema,
} from '../schemas/subscription.schema';
import { Invoice, InvoiceSchema } from './schemas/invoice.schema';
import {
  PaymentMethod,
  PaymentMethodSchema,
} from './schemas/payment-method.schema';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Subscription.name, schema: SubscriptionSchema },
      { name: Invoice.name, schema: InvoiceSchema },
      { name: PaymentMethod.name, schema: PaymentMethodSchema },
    ]),
  ],
  controllers: [SubscriptionController],
  providers: [SubscriptionService, StripeService, FeatureCheckService],
  exports: [SubscriptionService, StripeService, FeatureCheckService],
})
export class SubscriptionModule {}
