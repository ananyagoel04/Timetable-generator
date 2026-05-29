#!/usr/bin/env node
/**
 * scripts/fixIndexes.js — MongoDB Index Repair Script
 *
 * Safely drops invalid parallel-array indexes from the LessonBlock collection
 * and backfills periodStart/periodEnd scalar fields.
 *
 * Usage: npm run indexes:fix
 */

const mongoose = require('mongoose');
const path = require('path');

// Load environment
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/timetable';

// Known bad index patterns — any index with BOTH 'classes' and 'periods' as keys
const INVALID_INDEX_PATTERNS = [
  { 'classes': 1, 'periods': 1 },       // any compound with both array fields
  { 'classes': 1, 'periods': -1 },
];

function isInvalidIndex(indexKeys) {
  const keys = Object.keys(indexKeys);
  const hasClasses = keys.includes('classes');
  const hasPeriods = keys.includes('periods');
  // MongoDB cannot have compound multikey index on two array fields
  return hasClasses && hasPeriods;
}

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  LessonBlock Index Repair Script');
  console.log('═══════════════════════════════════════════════════');
  console.log(`  Target: ${MONGO_URI}`);
  console.log('');

  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to MongoDB');

  const db = mongoose.connection.db;
  const collection = db.collection('lessonblocks');

  // Step 1: List all current indexes
  console.log('\n── Step 1: Current Indexes ──');
  const indexes = await collection.indexes();
  for (const idx of indexes) {
    const keys = JSON.stringify(idx.key);
    const invalid = isInvalidIndex(idx.key);
    console.log(`  ${invalid ? '❌' : '✅'} ${idx.name}: ${keys}${invalid ? ' [INVALID — parallel arrays]' : ''}`);
  }

  // Step 2: Drop invalid indexes
  console.log('\n── Step 2: Dropping Invalid Indexes ──');
  let dropped = 0;
  for (const idx of indexes) {
    if (idx.name === '_id_') continue; // never drop _id
    if (isInvalidIndex(idx.key)) {
      try {
        await collection.dropIndex(idx.name);
        console.log(`  ✅ Dropped: ${idx.name}`);
        dropped++;
      } catch (err) {
        console.log(`  ⚠️  Could not drop ${idx.name}: ${err.message}`);
      }
    }
  }
  if (dropped === 0) {
    console.log('  ℹ️  No invalid indexes found (already clean)');
  }

  // Step 3: Backfill periodStart/periodEnd on existing documents
  console.log('\n── Step 3: Backfilling periodStart/periodEnd ──');
  const docsWithoutScalars = await collection.countDocuments({
    periods: { $exists: true, $ne: [] },
    periodStart: { $exists: false }
  });

  if (docsWithoutScalars > 0) {
    console.log(`  Found ${docsWithoutScalars} documents needing backfill...`);
    
    const cursor = collection.find({
      periods: { $exists: true, $ne: [] },
      periodStart: { $exists: false }
    });

    let updated = 0;
    const bulkOps = [];
    
    for await (const doc of cursor) {
      const periods = doc.periods || [];
      if (periods.length > 0) {
        bulkOps.push({
          updateOne: {
            filter: { _id: doc._id },
            update: {
              $set: {
                periodStart: Math.min(...periods),
                periodEnd: Math.max(...periods)
              }
            }
          }
        });
      }
      
      if (bulkOps.length >= 500) {
        const result = await collection.bulkWrite(bulkOps);
        updated += result.modifiedCount;
        bulkOps.length = 0;
      }
    }
    
    if (bulkOps.length > 0) {
      const result = await collection.bulkWrite(bulkOps);
      updated += result.modifiedCount;
    }
    
    console.log(`  ✅ Backfilled ${updated} documents`);
  } else {
    console.log('  ℹ️  All documents already have periodStart/periodEnd (or no documents exist)');
  }

  // Step 4: Verify final index state
  console.log('\n── Step 4: Final Index State ──');
  const finalIndexes = await collection.indexes();
  let allGood = true;
  for (const idx of finalIndexes) {
    const keys = JSON.stringify(idx.key);
    if (isInvalidIndex(idx.key)) {
      console.log(`  ❌ ${idx.name}: ${keys} [STILL INVALID]`);
      allGood = false;
    } else {
      console.log(`  ✅ ${idx.name}: ${keys}`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════');
  if (allGood) {
    console.log('  ✅ ALL INDEXES VALID — No parallel array conflicts');
  } else {
    console.log('  ❌ SOME INVALID INDEXES REMAIN — Manual intervention needed');
  }
  console.log('═══════════════════════════════════════════════════');

  await mongoose.disconnect();
  console.log('\n✅ Disconnected from MongoDB');
  process.exit(allGood ? 0 : 1);
}

main().catch(err => {
  console.error('❌ Fatal error:', err.message);
  process.exit(1);
});
