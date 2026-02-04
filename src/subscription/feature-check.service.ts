/// 💎 Feature Check Service
///
/// Service for checking subscription-based feature access
import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../schemas/user.schema';
import {
  Subscription,
  SubscriptionDocument,
} from '../schemas/subscription.schema';

export interface FeatureCheckResult {
  canAccess: boolean;
  remaining?: number;
  error?: string;
}

@Injectable()
export class FeatureCheckService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Subscription.name)
    private subscriptionModel: Model<SubscriptionDocument>,
  ) {}

  async checkSubscription(
    userId: string,
    requiredTier: 'pro' | 'premium',
  ): Promise<FeatureCheckResult> {
    const user = await this.userModel.findById(new Types.ObjectId(userId));

    if (!user) {
      return { canAccess: false, error: 'User not found' };
    }

    const tier = user.subscriptionTier || 'free';
    const tierOrder = { free: 0, pro: 1, premium: 2 };
    const userLevel = tierOrder[tier as keyof typeof tierOrder] || 0;
    const requiredLevel = tierOrder[requiredTier];

    if (userLevel < requiredLevel) {
      return {
        canAccess: false,
        error: `This feature requires ${requiredTier} subscription`,
      };
    }

    return { canAccess: true };
  }

  async checkBoostLimit(userId: string): Promise<FeatureCheckResult> {
    const subscription = await this.subscriptionModel.findOne({
      userId: new Types.ObjectId(userId),
    });

    const features = (subscription?.features as any) || {};
    const maxBoosts = features?.maxProfileBoosts ?? 0;
    const boostsUsed = subscription?.boostsUsedThisMonth ?? 0;
    const remaining = maxBoosts - boostsUsed;

    // Premium has unlimited (-1 means unlimited)
    if (maxBoosts === -1) {
      return { canAccess: true, remaining: -1 };
    }

    if (boostsUsed >= maxBoosts) {
      return {
        canAccess: false,
        remaining: 0,
        error: 'No boosts remaining. Upgrade for unlimited boosts.',
      };
    }

    return { canAccess: true, remaining };
  }

  async checkGigApplicationLimit(userId: string): Promise<FeatureCheckResult> {
    const subscription = await this.subscriptionModel.findOne({
      userId: new Types.ObjectId(userId),
    });

    const features = (subscription?.features as any) || {};
    const maxApps = features?.maxGigApplications ?? 5;
    const appsUsedThisMonth = await this.getApplicationsUsedThisMonth(userId);

    if (maxApps === -1) {
      // Premium
      return { canAccess: true, remaining: -1 };
    }

    if (appsUsedThisMonth >= maxApps) {
      return {
        canAccess: false,
        remaining: 0,
        error:
          'No gig applications remaining. Upgrade for unlimited applications.',
      };
    }

    return { canAccess: true, remaining: maxApps - appsUsedThisMonth };
  }

  async incrementBoostUsed(userId: string): Promise<void> {
    await this.subscriptionModel.updateOne(
      { userId: new Types.ObjectId(userId) },
      { $inc: { boostsUsedThisMonth: 1 } },
    );
  }

  async getApplicationsUsedThisMonth(userId: string): Promise<number> {
    // This should query the gigs.applications collection
    // Simplified version - implement proper count
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    // This is a placeholder - implement actual count query
    return 0;
  }

  /**
   * Get tier-based limits for a user
   */
  getTierLimits(tier: string): {
    maxGigApplications: number;
    maxBoosts: number;
    maxMediaUploads: number;
  } {
    switch (tier) {
      case 'premium':
        return {
          maxGigApplications: -1, // Unlimited
          maxBoosts: -1, // Unlimited
          maxMediaUploads: -1, // Unlimited
        };
      case 'pro':
        return {
          maxGigApplications: 20,
          maxBoosts: 5,
          maxMediaUploads: 10,
        };
      default:
        return {
          maxGigApplications: 5,
          maxBoosts: 0,
          maxMediaUploads: 3,
        };
    }
  }
}
