/**
 * 📦 GigMatch Subscription Migration Runner
 *
 * A Node.js script to run the subscription migration using the native MongoDB driver.
 * 
 * Usage:
 *   cd gigmatch
 *   node scripts/run-migration.mjs
 */

import { MongoClient } from 'mongodb';

// Read .env manually since we're in ESM context
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
let envContent = '';
try {
  envContent = readFileSync(join(__dirname, '..', '.env'), 'utf-8');
} catch (e) {
  // .env not found, use defaults
}

// Parse MONGODB_URI from .env
let MONGODB_URI = 'mongodb://localhost:27017/gigmatch';
const match = envContent.match(/MONGODB_URI=(.+)/);
if (match) {
  MONGODB_URI = match[1].trim();
}

async function runMigration() {
  console.log('🚀 Starting GigMatch subscription migration...\n');
  console.log(`📡 Connecting to: ${MONGODB_URI.replace(/:[^:@]*@/, ':****@')}\n`);

  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    const db = client.db();

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 1: Add subscriptionTier to users who don't have it
    // ═══════════════════════════════════════════════════════════════════════

    console.log('📌 Step 1: Adding subscriptionTier to users...');
    const userResult = await db.collection('users').updateMany(
      { subscriptionTier: { $exists: false } },
      { $set: { subscriptionTier: 'free', hasActiveSubscription: false } }
    );
    console.log(`   ✅ Updated ${userResult.modifiedCount} users with default subscription fields\n`);

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 2: Sync subscriptionTier from existing active subscriptions
    // ═══════════════════════════════════════════════════════════════════════

    console.log('📌 Step 2: Syncing active subscriptions to users...');
    const activeSubscriptions = await db.collection('subscriptions')
      .find({ status: 'active' })
      .toArray();

    let syncCount = 0;
    for (const sub of activeSubscriptions) {
      const tier = sub.tier || sub.plan || 'free';
      await db.collection('users').updateOne(
        { _id: sub.userId },
        { $set: { subscriptionTier: tier, hasActiveSubscription: true } }
      );
      syncCount++;
    }
    console.log(`   ✅ Synced ${syncCount} active subscriptions to users\n`);

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 3: Add tier field to subscriptions missing it
    // ═══════════════════════════════════════════════════════════════════════

    console.log('📌 Step 3: Adding tier field to subscriptions...');
    const subResult = await db.collection('subscriptions').updateMany(
      { tier: { $exists: false } },
      [{ $set: { tier: { $ifNull: ['$plan', 'free'] } } }]
    );
    console.log(`   ✅ Updated ${subResult.modifiedCount} subscriptions with tier field\n`);

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 4: Add hasActiveSubscription to subscriptions
    // ═══════════════════════════════════════════════════════════════════════

    console.log('📌 Step 4: Setting hasActiveSubscription on subscriptions...');
    const hasActiveResult = await db.collection('subscriptions').updateMany(
      { hasActiveSubscription: { $exists: false } },
      [{ $set: { hasActiveSubscription: { $eq: ['$status', 'active'] } } }]
    );
    console.log(`   ✅ Updated ${hasActiveResult.modifiedCount} subscriptions\n`);

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 5: Add default features to subscriptions missing them
    // ═══════════════════════════════════════════════════════════════════════

    console.log('📌 Step 5: Adding default features to subscriptions...');
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

    const featuresResult = await db.collection('subscriptions').updateMany(
      { features: { $exists: false } },
      { $set: { features: defaultFeatures } }
    );
    console.log(`   ✅ Added default features to ${featuresResult.modifiedCount} subscriptions\n`);

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 6: Update features for PRO tier subscriptions
    // ═══════════════════════════════════════════════════════════════════════

    console.log('📌 Step 6: Updating PRO tier features...');
    const proFeatures = {
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
    };

    const proResult = await db.collection('subscriptions').updateMany(
      { tier: 'pro' },
      { $set: { features: proFeatures } }
    );
    console.log(`   ✅ Updated ${proResult.modifiedCount} PRO subscriptions\n`);

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 7: Update features for PREMIUM tier subscriptions
    // ═══════════════════════════════════════════════════════════════════════

    console.log('📌 Step 7: Updating PREMIUM tier features...');
    const premiumFeatures = {
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
    };

    const premiumResult = await db.collection('subscriptions').updateMany(
      { tier: 'premium' },
      { $set: { features: premiumFeatures } }
    );
    console.log(`   ✅ Updated ${premiumResult.modifiedCount} PREMIUM subscriptions\n`);

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 8: Fix any 'basic' tiers to 'pro' (schema migration)
    // ═══════════════════════════════════════════════════════════════════════

    console.log('📌 Step 8: Migrating "basic" tier to "pro"...');
    const basicResult = await db.collection('subscriptions').updateMany(
      { $or: [{ tier: 'basic' }, { plan: 'basic' }] },
      { $set: { tier: 'pro', plan: 'pro', features: proFeatures } }
    );
    console.log(`   ✅ Migrated ${basicResult.modifiedCount} basic subscriptions to pro\n`);

    // Also update users
    const basicUserResult = await db.collection('users').updateMany(
      { subscriptionTier: 'basic' },
      { $set: { subscriptionTier: 'pro' } }
    );
    console.log(`   ✅ Migrated ${basicUserResult.modifiedCount} users from basic to pro tier\n`);

    // ═══════════════════════════════════════════════════════════════════════
    // SUMMARY
    // ═══════════════════════════════════════════════════════════════════════

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🎉 Migration Complete!');
    console.log('═══════════════════════════════════════════════════════════════');

    // Count summary
    const totalUsers = await db.collection('users').countDocuments();
    const freeUsers = await db.collection('users').countDocuments({ subscriptionTier: 'free' });
    const proUsers = await db.collection('users').countDocuments({ subscriptionTier: 'pro' });
    const premiumUsers = await db.collection('users').countDocuments({ subscriptionTier: 'premium' });
    const activeSubsCount = await db.collection('subscriptions').countDocuments({ status: 'active' });

    console.log(`\n📊 Current State:`);
    console.log(`   Total Users: ${totalUsers}`);
    console.log(`   Free Users: ${freeUsers}`);
    console.log(`   Pro Users: ${proUsers}`);
    console.log(`   Premium Users: ${premiumUsers}`);
    console.log(`   Active Subscriptions: ${activeSubsCount}`);
    console.log('\n');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

runMigration();
