// 📦 GigMatch Subscription Migration Script (MongoDB Shell)
//
// Run this script in MongoDB shell or Compass to update existing documents
//
// Usage:
//   mongosh "mongodb://localhost:27017/gigmatch" migration-run.js
//   OR
//   mongosh "your-mongodb-atlas-uri" migration-run.js
//
// This script is idempotent and safe to run multiple times.

print('🚀 Starting GigMatch subscription migration...\n');

// ═══════════════════════════════════════════════════════════════════════════
// STEP 1: Add subscriptionTier to users who don't have it
// ═══════════════════════════════════════════════════════════════════════════

print('📌 Step 1: Adding subscriptionTier to users...');
const userResult = db.users.updateMany(
  { subscriptionTier: { $exists: false } },
  { $set: { subscriptionTier: 'free', hasActiveSubscription: false } }
);
print(`   ✅ Updated ${userResult.modifiedCount} users with default subscription fields\n`);

// ═══════════════════════════════════════════════════════════════════════════
// STEP 2: Sync subscriptionTier from existing active subscriptions
// ═══════════════════════════════════════════════════════════════════════════

print('📌 Step 2: Syncing active subscriptions to users...');
let syncCount = 0;
db.subscriptions.find({ status: 'active' }).forEach(function(sub) {
  const tier = sub.tier || sub.plan || 'free';
  db.users.updateOne(
    { _id: sub.userId },
    { $set: { subscriptionTier: tier, hasActiveSubscription: true } }
  );
  syncCount++;
});
print(`   ✅ Synced ${syncCount} active subscriptions to users\n`);

// ═══════════════════════════════════════════════════════════════════════════
// STEP 3: Add tier field to subscriptions missing it
// ═══════════════════════════════════════════════════════════════════════════

print('📌 Step 3: Adding tier field to subscriptions...');
const subResult = db.subscriptions.updateMany(
  { tier: { $exists: false } },
  [{ $set: { tier: { $ifNull: ['$plan', 'free'] } } }]
);
print(`   ✅ Updated ${subResult.modifiedCount} subscriptions with tier field\n`);

// ═══════════════════════════════════════════════════════════════════════════
// STEP 4: Add hasActiveSubscription to subscriptions
// ═══════════════════════════════════════════════════════════════════════════

print('📌 Step 4: Setting hasActiveSubscription on subscriptions...');
const hasActiveResult = db.subscriptions.updateMany(
  { hasActiveSubscription: { $exists: false } },
  [{ $set: { hasActiveSubscription: { $eq: ['$status', 'active'] } } }]
);
print(`   ✅ Updated ${hasActiveResult.modifiedCount} subscriptions\n`);

// ═══════════════════════════════════════════════════════════════════════════
// STEP 5: Add default features to subscriptions missing them
// ═══════════════════════════════════════════════════════════════════════════

print('📌 Step 5: Adding default features to subscriptions...');
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

const featuresResult = db.subscriptions.updateMany(
  { features: { $exists: false } },
  { $set: { features: defaultFeatures } }
);
print(`   ✅ Added default features to ${featuresResult.modifiedCount} subscriptions\n`);

// ═══════════════════════════════════════════════════════════════════════════
// STEP 6: Update features for PRO tier subscriptions
// ═══════════════════════════════════════════════════════════════════════════

print('📌 Step 6: Updating PRO tier features...');
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

const proResult = db.subscriptions.updateMany(
  { tier: 'pro' },
  { $set: { features: proFeatures } }
);
print(`   ✅ Updated ${proResult.modifiedCount} PRO subscriptions\n`);

// ═══════════════════════════════════════════════════════════════════════════
// STEP 7: Update features for PREMIUM tier subscriptions
// ═══════════════════════════════════════════════════════════════════════════

print('📌 Step 7: Updating PREMIUM tier features...');
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

const premiumResult = db.subscriptions.updateMany(
  { tier: 'premium' },
  { $set: { features: premiumFeatures } }
);
print(`   ✅ Updated ${premiumResult.modifiedCount} PREMIUM subscriptions\n`);

// ═══════════════════════════════════════════════════════════════════════════
// STEP 8: Fix any 'basic' tiers to 'pro' (schema migration)
// ═══════════════════════════════════════════════════════════════════════════

print('📌 Step 8: Migrating "basic" tier to "pro"...');
const basicResult = db.subscriptions.updateMany(
  { $or: [{ tier: 'basic' }, { plan: 'basic' }] },
  { $set: { tier: 'pro', plan: 'pro', features: proFeatures } }
);
print(`   ✅ Migrated ${basicResult.modifiedCount} basic subscriptions to pro\n`);

// Also update users
const basicUserResult = db.users.updateMany(
  { subscriptionTier: 'basic' },
  { $set: { subscriptionTier: 'pro' } }
);
print(`   ✅ Migrated ${basicUserResult.modifiedCount} users from basic to pro tier\n`);

// ═══════════════════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════════════════

print('═══════════════════════════════════════════════════════════════════');
print('🎉 Migration Complete!');
print('═══════════════════════════════════════════════════════════════════');

// Count summary
const totalUsers = db.users.countDocuments();
const freeUsers = db.users.countDocuments({ subscriptionTier: 'free' });
const proUsers = db.users.countDocuments({ subscriptionTier: 'pro' });
const premiumUsers = db.users.countDocuments({ subscriptionTier: 'premium' });
const activeSubscriptions = db.subscriptions.countDocuments({ status: 'active' });

print(`\n📊 Current State:`);
print(`   Total Users: ${totalUsers}`);
print(`   Free Users: ${freeUsers}`);
print(`   Pro Users: ${proUsers}`);
print(`   Premium Users: ${premiumUsers}`);
print(`   Active Subscriptions: ${activeSubscriptions}`);
print('\n');
