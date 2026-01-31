#!/usr/bin/env node
/**
 * 🚨 RESET DATABASE SCRIPT
 * Deletes all users and related data from MongoDB
 * Run with: pnpm run db:reset
 * 
 * Database URL is read from .env file (MONGODB_URI)
 */

const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

// Read .env file manually
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=');
          process.env[key.trim()] = value.trim();
        }
      }
    }
  } catch (error) {
    console.warn('⚠️  Could not read .env file, using defaults');
  }
}

loadEnv();

// MongoDB connection URI from .env
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gigmatch';
const DB_NAME = process.env.MONGODB_DB_NAME || 'gigmatch';

async function resetDatabase() {
  console.log('🚨 ========================================');
  console.log('🚨 RESETTING DATABASE - DELETING ALL DATA');
  console.log('🚨 ========================================');
  console.log(`📍 URI: ${MONGODB_URI}`);
  console.log(`📦 Database: ${DB_NAME}`);
  console.log('');

  const client = new MongoClient(MONGODB_URI);

  try {
    // Connect to MongoDB
    console.log('🔌 Connecting to MongoDB...');
    await client.connect();
    console.log('✅ Connected successfully');

    const db = client.db(DB_NAME);

    // Get all collections
    const collections = await db.listCollections().toArray();
    console.log(`📋 Found ${collections.length} collections`);
    console.log('');

    // Delete from each collection
    const results = {};
    for (const collection of collections) {
      const collectionName = collection.name;
      console.log(`🗑️  Deleting from ${collectionName}...`);
      
      const result = await db.collection(collectionName).deleteMany({});
      results[collectionName] = result.deletedCount;
      
      console.log(`   ✓ Deleted ${result.deletedCount} documents`);
    }

    console.log('');
    console.log('✅ ========================================');
    console.log('✅ DATABASE RESET COMPLETE');
    console.log('✅ ========================================');
    console.log('');
    console.log('📊 Summary:');
    Object.entries(results).forEach(([collection, count]) => {
      console.log(`   ${collection}: ${count} deleted`);
    });

    return results;

  } catch (error) {
    console.error('❌ Error resetting database:', error);
    throw error;
  } finally {
    await client.close();
    console.log('');
    console.log('🔌 Database connection closed');
  }
}

// Run the script
resetDatabase()
  .then(() => {
    console.log('');
    console.log('🎉 Done! You can now create new users.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
