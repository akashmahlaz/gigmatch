/// 📦 Subscription Migration Script
///
/// Run this migration to update existing documents with new subscription fields.
/// Usage: npx ts-node src/migrations/subscription-migration.ts
///
/// Or import and call from a NestJS command/service.

import { Injectable, Logger } from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Types, Connection } from 'mongoose';
import { User, UserDocument } from '../schemas/user.schema';
import {
  Subscription,
  SubscriptionDocument,
  SubscriptionStatus,
} from '../schemas/subscription.schema';

@Injectable()
export class SubscriptionMigration {
  private readonly logger = new Logger(SubscriptionMigration.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Subscription.name)
    private subscriptionModel: Model<SubscriptionDocument>,
    @InjectConnection() private connection: Connection,
  ) {}

  async run(): Promise<void> {
    this.logger.log('🚀 Running subscription migration...');

    try {
      // 1. Add subscriptionTier to users who don't have it
      const userResult = await this.userModel.updateMany(
        { subscriptionTier: { $exists: false } },
        {
          $set: {
            subscriptionTier: 'free',
            hasActiveSubscription: false,
          },
        },
      );
      this.logger.log(
        `✅ Updated ${userResult.modifiedCount} users with default subscription fields`,
      );

      // 2. Sync subscriptionTier from existing subscriptions
      const subscriptions = await this.subscriptionModel
        .find({ status: SubscriptionStatus.ACTIVE })
        .lean();

      for (const sub of subscriptions) {
        const tier = sub.tier || sub.plan || 'free';
        await this.userModel.updateOne(
          { _id: sub.userId },
          {
            $set: {
              subscriptionTier: tier,
              hasActiveSubscription: true,
            },
          },
        );
      }
      this.logger.log(
        `✅ Synced ${subscriptions.length} active subscriptions to users`,
      );

      // 3. Add tier field to subscriptions missing it
      const subResult = await this.subscriptionModel.updateMany(
        { tier: { $exists: false } },
        [
          {
            $set: {
              tier: { $ifNull: ['$plan', 'free'] },
            },
          },
        ],
      );
      this.logger.log(
        `✅ Updated ${subResult.modifiedCount} subscriptions with tier field`,
      );

      // 4. Ensure hasActiveSubscription is set on subscriptions
      await this.subscriptionModel.updateMany(
        { hasActiveSubscription: { $exists: false } },
        [
          {
            $set: {
              hasActiveSubscription: {
                $cond: [{ $eq: ['$status', 'active'] }, true, false],
              },
            },
          },
        ],
      );
      this.logger.log('✅ Updated hasActiveSubscription on subscriptions');

      // 5. Add default features to subscriptions missing them
      const defaultFeatures = {
        dailySwipeLimit: 100,
        canSeeWhoLikedYou: false,
        boostsPerMonth: 0,
        maxProfileBoosts: 0,
        priorityInSearch: false,
        advancedAnalytics: false,
        customProfileUrl: false,
        verifiedBadge: false,
        unlimitedMessages: true,
        canSeeViews: false,
        canUseAdvancedFilters: false,
        canMessageFirst: false,
        canSeeReadReceipts: false,
        maxGigApplications: 5,
        canAccessAnalytics: false,
        maxMediaUploads: 3,
      };

      const featuresResult = await this.subscriptionModel.updateMany(
        { features: { $exists: false } },
        {
          $set: {
            features: defaultFeatures,
          },
        },
      );
      this.logger.log(
        `✅ Added default features to ${featuresResult.modifiedCount} subscriptions`,
      );

      // 6. Update features based on tier for existing subscriptions
      await this.updateFeaturesForTier('pro', {
        dailySwipeLimit: -1, // Unlimited
        canSeeWhoLikedYou: true,
        boostsPerMonth: 5,
        maxProfileBoosts: 5,
        priorityInSearch: false,
        advancedAnalytics: true,
        customProfileUrl: false,
        verifiedBadge: false,
        unlimitedMessages: true,
        canSeeViews: true,
        canUseAdvancedFilters: true,
        canMessageFirst: true,
        canSeeReadReceipts: true,
        maxGigApplications: 20,
        canAccessAnalytics: true,
        maxMediaUploads: 10,
      });

      await this.updateFeaturesForTier('premium', {
        dailySwipeLimit: -1, // Unlimited
        canSeeWhoLikedYou: true,
        boostsPerMonth: -1, // Unlimited
        maxProfileBoosts: -1, // Unlimited
        priorityInSearch: true,
        advancedAnalytics: true,
        customProfileUrl: true,
        verifiedBadge: true,
        unlimitedMessages: true,
        canSeeViews: true,
        canUseAdvancedFilters: true,
        canMessageFirst: true,
        canSeeReadReceipts: true,
        maxGigApplications: -1, // Unlimited
        canAccessAnalytics: true,
        maxMediaUploads: -1, // Unlimited
      });

      this.logger.log('✅ Updated features for pro and premium tiers');

      this.logger.log('🎉 Migration complete!');
    } catch (error) {
      this.logger.error(`❌ Migration failed: ${error}`);
      throw error;
    }
  }

  private async updateFeaturesForTier(
    tier: string,
    features: Record<string, any>,
  ): Promise<void> {
    await this.subscriptionModel.updateMany(
      { tier },
      {
        $set: { features },
      },
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// STANDALONE RUNNER (for running with ts-node)
// ═══════════════════════════════════════════════════════════════════════════

/*
 * To run this migration standalone:
 *
 * 1. Add to a CLI command in your NestJS app
 * 2. Or create a bootstrap script that connects to MongoDB and runs the migration
 *
 * Example CLI command module:
 *
 * @Command({ name: 'migrate:subscription', description: 'Run subscription migration' })
 * export class MigrateSubscriptionCommand {
 *   constructor(private migration: SubscriptionMigration) {}
 *
 *   async run(): Promise<void> {
 *     await this.migration.run();
 *   }
 * }
 */
