/**
 * Debug script to check subscription data
 */

import { MongoClient } from 'mongodb';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
let envContent = '';
try {
  envContent = readFileSync(join(__dirname, '..', '.env'), 'utf-8');
} catch (e) {
  // .env not found
}

let MONGODB_URI = 'mongodb://localhost:27017/gigmatch';
const match = envContent.match(/MONGODB_URI=(.+)/);
if (match) {
  MONGODB_URI = match[1].trim();
}

async function debugSubscriptions() {
  console.log('🔍 Checking subscription data...\n');
  
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    const db = client.db();

    // Get all subscriptions
    const subscriptions = await db.collection('subscriptions').find({}).toArray();
    
    console.log(`Found ${subscriptions.length} total subscriptions:\n`);
    
    for (const sub of subscriptions) {
      console.log('═══════════════════════════════════════════════════════');
      console.log(`Subscription ID: ${sub._id}`);
      console.log(`User ID: ${sub.userId}`);
      console.log(`Status: ${sub.status}`);
      console.log(`Plan: ${sub.plan}`);
      console.log(`Tier: ${sub.tier || '(not set)'}`);
      console.log(`Has Active: ${sub.hasActiveSubscription}`);
      console.log(`Stripe Sub ID: ${sub.stripeSubscriptionId || '(none)'}`);
      
      // Find the user
      const user = await db.collection('users').findOne({ _id: sub.userId });
      if (user) {
        console.log(`\nLinked User:`);
        console.log(`  Email: ${user.email}`);
        console.log(`  Name: ${user.fullName}`);
        console.log(`  User's subscriptionTier: ${user.subscriptionTier || '(not set)'}`);
        console.log(`  User's hasActiveSubscription: ${user.hasActiveSubscription}`);
      } else {
        console.log(`\n⚠️  No user found with ID ${sub.userId}`);
      }
      console.log('');
    }
    
    // Get all users with their subscription info
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('All Users:');
    console.log('═══════════════════════════════════════════════════════\n');
    
    const users = await db.collection('users').find({}).toArray();
    for (const user of users) {
      console.log(`User: ${user.email}`);
      console.log(`  subscriptionTier: ${user.subscriptionTier || '(not set)'}`);
      console.log(`  hasActiveSubscription: ${user.hasActiveSubscription}`);
      console.log(`  subscription (ref): ${user.subscription || '(none)'}`);
      console.log('');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

debugSubscriptions();
