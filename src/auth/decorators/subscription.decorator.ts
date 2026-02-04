/// 💳 Subscription Decorator
///
/// Decorator for requiring subscription tier on endpoints
import { SetMetadata } from '@nestjs/common';

export const SUBSCRIPTION_GUARD_KEY = 'subscription_guard';
export const RequireSubscription = (tier: 'pro' | 'premium') =>
  SetMetadata(SUBSCRIPTION_GUARD_KEY, tier);
