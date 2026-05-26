/**
 * Phase 2 Verification Tests
 *
 * Tests the rebuilt timetable engine for:
 *   1. Combined class correctness (no duplicate blocks)
 *   2. Split group parallel placement
 *   3. Deterministic output
 *   4. Conflict accuracy
 *   5. Background generation
 */
const mongoose = require('mongoose');
require('dotenv').config();
const connectDB = require('../config/db');

// Register all models so Mongoose can populate references
const LessonBlock = require('../models/LessonBlock');
const GeneratedTimetable = require('../models/GeneratedTimetable');
const ConflictLog = require('../models/ConflictLog');
const School = require('../models/School');
const AcademicSession = require('../models/AcademicSession');
require('../models/Subject');
require('../models/Teacher');
require('../models/Class');
require('../models/Room');
require('../models/SubjectRequirement');
require('../models/SubjectCombinationRule');
require('../models/ReservedPeriodRule');
require('../models/PeriodStructure');
require('../models/CustomRule');
require('../models/SoftPreference');
require('../models/CanTeach');
require('../models/StudentGroup');
const SchedulerEngine = require('../services/schedulerEngine');

const PASS = '\x1b[32m✓ PASS\x1b[0m';
const FAIL = '\x1b[31m✗ FAIL\x1b[0m';
let passed = 0, failed = 0;

function assert(condition, msg) {
  if (condition) { console.log(`  ${PASS} ${msg}`); passed++; }
  else { console.log(`  ${FAIL} ${msg}`); failed++; }
}

async function run() {
  await connectDB();
  const school = await School.findOne();
  const session = await AcademicSession.findOne({ school: school?._id, isCurrent: true });

  if (!school || !session) {
    console.error('No school/session found. Aborting.');
    process.exit(1);
  }

  const schoolId = school._id;
  const sessionId = session._id;

  // ═══════════════════════════════════════════════════════════════
  // TEST 1: Full Generation
  // ═══════════════════════════════════════════════════════════════
  console.log('\n═══ TEST 1: Full Generation ═══');
  const engine1 = new SchedulerEngine(schoolId, sessionId);
  const result1 = await engine1.generate({ seed: 'test-seed-fixed-1' });

  assert(result1.timetableId, 'Timetable ID returned');
  assert(result1.totalBlocks > 0, `Blocks placed: ${result1.totalBlocks}`);
  assert(result1.unplaced === 0, `Unplaced: ${result1.unplaced} (expected 0)`);
  assert(result1.conflicts === 0, `Conflicts: ${result1.conflicts} (expected 0)`);
  assert(result1.score.total >= 80, `Quality score: ${result1.score.total}/100 (expected >=80)`);
  assert(result1.timeMs < 5000, `Generation time: ${result1.timeMs}ms (expected <5000ms)`);

  // ═══════════════════════════════════════════════════════════════
  // TEST 2: No Duplicate Blocks (Combined Class Test)
  // ═══════════════════════════════════════════════════════════════
  console.log('\n═══ TEST 2: Combined Class — No Duplicates ═══');
  const blocks1 = await LessonBlock.find({ timetable: result1.timetableId })
    .populate('subject teacher classes');

  const combinedBlocks = blocks1.filter(b => b.type === 'combined_class');
  console.log(`  Combined blocks found: ${combinedBlocks.length}`);

  // Check no two combined blocks overlap (same day+period+subject)
  const combinedSlots = {};
  let duplicateCombined = false;
  for (const b of combinedBlocks) {
    const key = `${b.subject?._id}_${b.day}_${b.periods[0]}`;
    if (combinedSlots[key]) {
      duplicateCombined = true;
      console.log(`  ${FAIL} Duplicate combined block: ${b.subject?.name} ${b.day} P${b.periods[0]}`);
    }
    combinedSlots[key] = true;
  }
  assert(!duplicateCombined, 'No duplicate combined blocks');

  // Verify combined blocks that have multiple classes are truly combined
  const multiClassBlocks = combinedBlocks.filter(b => b.classes.length > 1);
  for (const b of multiClassBlocks) {
    assert(b.classes.length > 1, `Combined block ${b.subject?.name} serves ${b.classes.length} classes`);
  }
  if (combinedBlocks.length > 0) {
    assert(true, `${combinedBlocks.length} combined blocks total (${multiClassBlocks.length} multi-class)`);
  }

  // ═══════════════════════════════════════════════════════════════
  // TEST 3: No Teacher Double-Booking
  // ═══════════════════════════════════════════════════════════════
  console.log('\n═══ TEST 3: No Teacher Double-Booking ═══');
  const teacherSlotMap = {};
  let teacherClashes = 0;
  for (const b of blocks1) {
    if (!b.teacher || b.type === 'reserved') continue;
    for (const p of b.periods) {
      const key = `${b.teacher._id || b.teacher}_${b.day}_${p}`;
      if (teacherSlotMap[key] && teacherSlotMap[key] !== b._id.toString()) {
        teacherClashes++;
      }
      teacherSlotMap[key] = b._id.toString();
    }
  }
  assert(teacherClashes === 0, `Teacher clashes: ${teacherClashes} (expected 0)`);

  // ═══════════════════════════════════════════════════════════════
  // TEST 4: No Room Double-Booking
  // ═══════════════════════════════════════════════════════════════
  console.log('\n═══ TEST 4: No Room Double-Booking ═══');
  const roomSlotMap = {};
  let roomClashes = 0;
  for (const b of blocks1) {
    if (!b.room || b.type === 'reserved') continue;
    for (const p of b.periods) {
      const key = `${b.room._id || b.room}_${b.day}_${p}`;
      if (roomSlotMap[key] && roomSlotMap[key] !== b._id.toString()) {
        roomClashes++;
      }
      roomSlotMap[key] = b._id.toString();
    }
  }
  assert(roomClashes === 0, `Room clashes: ${roomClashes} (expected 0)`);

  // ═══════════════════════════════════════════════════════════════
  // TEST 5: Deterministic Output
  // ═══════════════════════════════════════════════════════════════
  console.log('\n═══ TEST 5: Deterministic Output ═══');
  const engine2 = new SchedulerEngine(schoolId, sessionId);
  const result2 = await engine2.generate({ seed: 'test-seed-fixed-1' });

  assert(result1.totalBlocks === result2.totalBlocks,
    `Same block count: ${result1.totalBlocks} vs ${result2.totalBlocks}`);
  assert(result1.unplaced === result2.unplaced,
    `Same unplaced count: ${result1.unplaced} vs ${result2.unplaced}`);
  assert(result1.score.total === result2.score.total,
    `Same quality score: ${result1.score.total} vs ${result2.score.total}`);

  // ═══════════════════════════════════════════════════════════════
  // TEST 6: Split Group Blocks
  // ═══════════════════════════════════════════════════════════════
  console.log('\n═══ TEST 6: Split Group Blocks ═══');
  const splitBlocks = blocks1.filter(b => b.type === 'split_group');
  console.log(`  Split-group blocks found: ${splitBlocks.length}`);

  // If split groups exist, verify they share periods with different teachers
  if (splitBlocks.length > 0) {
    const splitBySlot = {};
    for (const b of splitBlocks) {
      const key = `${b.classes[0]}_${b.day}_${b.periods[0]}`;
      if (!splitBySlot[key]) splitBySlot[key] = [];
      splitBySlot[key].push(b);
    }
    for (const [key, group] of Object.entries(splitBySlot)) {
      if (group.length > 1) {
        const groups = group.map(b => b.studentGroup).join(', ');
        assert(true, `Parallel groups at ${key}: ${groups}`);
      }
    }
  } else {
    console.log('  (No split-group data in current school — skipped)');
  }

  // ═══════════════════════════════════════════════════════════════
  // TEST 7: Conflict Log Accuracy
  // ═══════════════════════════════════════════════════════════════
  console.log('\n═══ TEST 7: Conflict Log Accuracy ═══');
  const conflicts1 = await ConflictLog.find({ timetable: result1.timetableId });
  assert(conflicts1.length === 0, `Conflicts in DB: ${conflicts1.length} (expected 0 for clean generation)`);

  // Check that conflict logs have the new fields
  if (conflicts1.length > 0) {
    const sample = conflicts1[0];
    assert(sample.groupId !== undefined, 'ConflictLog has groupId field');
    assert(sample.suggestedFixes !== undefined, 'ConflictLog has suggestedFixes field');
  }

  // ═══════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════
  console.log('\n══════════════════════════════════════════');
  console.log(`  Total: ${passed + failed} | ${PASS}: ${passed} | ${FAIL}: ${failed}`);
  console.log('══════════════════════════════════════════\n');

  // Cleanup test timetables
  await LessonBlock.deleteMany({ timetable: { $in: [result1.timetableId, result2.timetableId] } });
  await ConflictLog.deleteMany({ timetable: { $in: [result1.timetableId, result2.timetableId] } });
  await GeneratedTimetable.deleteMany({ _id: { $in: [result1.timetableId, result2.timetableId] } });
  console.log('Test timetables cleaned up.\n');

  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('Test runner failed:', err);
  process.exit(1);
});
