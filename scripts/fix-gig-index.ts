/**
 * Script to fix the 2dsphere index on the gigs collection
 * Run with: pnpm exec ts-node scripts/fix-gig-index.ts
 */

import mongoose from 'mongoose';

async function fixIndex() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/gigmatch';
  console.log('Connecting to:', uri);
  
  try {
    await mongoose.connect(uri);
    console.log('Connected to MongoDB');
    
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection not established');
    }
    const gigs = db.collection('gigs');
    
    // Get current indexes
    const indexes = await gigs.indexes();
    console.log('\nCurrent indexes on gigs collection:');
    indexes.forEach(idx => console.log('-', idx.name, ':', JSON.stringify(idx.key)));
    
    // Drop the incorrect index if it exists
    try {
      await gigs.dropIndex('location.coordinates_2dsphere');
      console.log('\nDropped old index: location.coordinates_2dsphere');
    } catch (e) {
      console.log('\nOld index "location.coordinates_2dsphere" not found or already dropped');
    }
    
    // Check if correct index already exists
    const hasCorrectIndex = indexes.some(idx => idx.name === 'location_2dsphere');
    if (hasCorrectIndex) {
      console.log('Correct index "location_2dsphere" already exists');
    } else {
      // Create the correct index
      await gigs.createIndex({ location: '2dsphere' });
      console.log('Created correct index: location_2dsphere');
    }
    
    // Verify
    const newIndexes = await gigs.indexes();
    console.log('\nFinal indexes on gigs collection:');
    newIndexes.forEach(idx => console.log('-', idx.name, ':', JSON.stringify(idx.key)));
    
    console.log('\n✅ Index fix complete!');
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

fixIndex();
