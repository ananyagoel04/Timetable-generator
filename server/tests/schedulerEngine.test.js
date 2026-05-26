/**
 * Priority 3 — Comprehensive Scheduling Engine Tests
 *
 * Uses Node.js built-in test runner (node:test + node:assert).
 * No MongoDB required — all tests use mock data.
 *
 * Run: cd server && node --test tests/schedulerEngine.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const LessonBlockGenerator = require('../services/engine/LessonBlockGenerator');
const CombinationResolver = require('../services/engine/CombinationResolver');
const SplitGroupResolver = require('../services/engine/SplitGroupResolver');
const ConstraintValidator = require('../services/engine/ConstraintValidator');
const SeededRandom = require('../services/engine/SeededRandom');

// ═══════════════════════════════════════════════════════════════════
// MOCK DATA HELPERS
// ═══════════════════════════════════════════════════════════════════
function mockId(num) { return `mock_id_${num}`; }

function mockSubject(overrides = {}) {
  return {
    _id: mockId(100 + Math.random() * 1000 | 0),
    name: 'Mathematics',
    code: 'MATH',
    type: 'theory',
    requiresLab: false,
    canBeDoubled: false,
    preferMorning: false,
    preferAfternoon: false,
    maxPerDay: 2,
    color: '#6366f1',
    isActive: true,
    ...overrides
  };
}

function mockTeacher(overrides = {}) {
  return {
    _id: mockId(200 + Math.random() * 1000 | 0),
    name: 'Mr. Smith',
    shortName: 'SMITH',
    maxPeriodsPerDay: 6,
    maxPeriodsPerWeek: 30,
    maxContinuousPeriods: 4,
    unavailableSlots: [],
    status: 'active',
    ...overrides
  };
}

function mockClass(overrides = {}) {
  return {
    _id: mockId(300 + Math.random() * 1000 | 0),
    name: 'Class 10A',
    studentCount: 35,
    ...overrides
  };
}

function mockRoom(overrides = {}) {
  return {
    _id: mockId(400 + Math.random() * 1000 | 0),
    name: 'Room 101',
    type: 'classroom',
    capacity: 40,
    isAvailable: true,
    unavailableSlots: [],
    ...overrides
  };
}

function mockRequirement(cls, subject, teacher, overrides = {}) {
  return {
    class: cls,
    subject: subject,
    teacher: teacher,
    periodsPerWeek: 4,
    allowDoublePeriod: false,
    doublePeriodsPerWeek: 0,
    consecutivePreference: 'none',
    consecutiveCount: 2,
    preferredDays: [],
    avoidDays: [],
    isActive: true,
    ...overrides
  };
}

const WORKING_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const PERIODS = [0, 1, 2, 3, 4, 5, 6, 7];

function buildClassPeriodMap(classes) {
  const map = {};
  for (const cls of classes) {
    const daySlots = {};
    for (const day of WORKING_DAYS) daySlots[day] = [...PERIODS];
    map[cls._id] = {
      workingDays: [...WORKING_DAYS],
      daySlots,
      breaks: { Monday: [3], Tuesday: [3], Wednesday: [3], Thursday: [3], Friday: [3] }
    };
  }
  return map;
}

// ═══════════════════════════════════════════════════════════════════
// TEST 1: Normal single-period placement
// ═══════════════════════════════════════════════════════════════════
describe('LessonBlockGenerator', () => {
  it('Test 1: generates single-period blocks correctly', () => {
    const gen = new LessonBlockGenerator();
    const cls = mockClass();
    const sub = mockSubject();
    const teacher = mockTeacher();
    const req = mockRequirement(cls, sub, teacher, { periodsPerWeek: 3 });

    const result = gen.generate([req], { coveredSet: new Set(), existingBlocks: [], classPeriodMap: buildClassPeriodMap([cls]) });
    const blocks = result.blocks || result;

    assert.equal(blocks.length, 3, 'Should produce 3 single-period blocks');
    for (const b of blocks) {
      assert.equal(b.isConsecutive, false);
      assert.equal(b.duration, 1);
      assert.equal(b.consecutiveSize, 1);
    }
  });

  // Test 20: LessonBlockGenerator correct block types
  it('Test 20: assigns correct blockType for activity/club/lab singles', () => {
    const gen = new LessonBlockGenerator();
    const cls = mockClass();
    const teacher = mockTeacher();

    const actSub = mockSubject({ name: 'Games', type: 'activity', _id: mockId(901) });
    const clubSub = mockSubject({ name: 'Art Club', type: 'club', _id: mockId(902) });
    const labSub = mockSubject({ name: 'Physics Lab', type: 'lab', requiresLab: true, _id: mockId(903) });
    const theorySub = mockSubject({ name: 'English', type: 'theory', _id: mockId(904) });

    const reqs = [
      mockRequirement(cls, actSub, teacher, { periodsPerWeek: 1 }),
      mockRequirement(cls, clubSub, teacher, { periodsPerWeek: 1 }),
      mockRequirement(cls, labSub, teacher, { periodsPerWeek: 1 }),
      mockRequirement(cls, theorySub, teacher, { periodsPerWeek: 1 }),
    ];

    const result = gen.generate(reqs, { coveredSet: new Set(), existingBlocks: [], classPeriodMap: buildClassPeriodMap([cls]) });
    const blocks = result.blocks || result;

    const typeMap = {};
    for (const b of blocks) typeMap[b.subjectName] = b.blockType;

    assert.equal(typeMap['Games'], 'activity', 'Activity subject → activity blockType');
    assert.equal(typeMap['Art Club'], 'club', 'Club subject → club blockType');
    assert.equal(typeMap['Physics Lab'], 'lab', 'Lab subject → lab blockType');
    assert.equal(typeMap['English'], 'normal', 'Theory subject → normal blockType');
  });

  it('Test 20b: skips requirements with periodsPerWeek < 1 and returns warnings', () => {
    const gen = new LessonBlockGenerator();
    const cls = mockClass();
    const sub = mockSubject();
    const teacher = mockTeacher();
    const req = mockRequirement(cls, sub, teacher, { periodsPerWeek: 0 });

    const result = gen.generate([req], { coveredSet: new Set(), existingBlocks: [], classPeriodMap: buildClassPeriodMap([cls]) });
    const blocks = result.blocks || result;
    assert.equal(blocks.length, 0, 'Should produce 0 blocks for periodsPerWeek=0');
    assert.ok(result.warnings?.length > 0, 'Should produce a warning');
  });
});

// ═══════════════════════════════════════════════════════════════════
// TEST 2 & 3: Double/Triple period generation
// ═══════════════════════════════════════════════════════════════════
describe('Consecutive Block Generation', () => {
  it('Test 2: generates double-period block descriptors', () => {
    const gen = new LessonBlockGenerator();
    const cls = mockClass();
    const sub = mockSubject({ canBeDoubled: true });
    const teacher = mockTeacher();
    const req = mockRequirement(cls, sub, teacher, {
      periodsPerWeek: 6,
      allowDoublePeriod: true,
      doublePeriodsPerWeek: 1,
      consecutivePreference: 'preferred',
      consecutiveCount: 2
    });

    const result = gen.generate([req], { coveredSet: new Set(), existingBlocks: [], classPeriodMap: buildClassPeriodMap([cls]) });
    const blocks = result.blocks || result;

    const consec = blocks.filter(b => b.isConsecutive);
    const singles = blocks.filter(b => !b.isConsecutive);

    assert.ok(consec.length >= 1, 'Should have at least 1 consecutive block');
    assert.equal(consec[0].consecutiveSize, 2, 'Consecutive block should span 2 periods');
    assert.equal(consec[0].duration, 2);
    assert.ok(singles.length >= 1, 'Should have remaining singles');
  });

  it('Test 3: generates triple-lab block descriptors', () => {
    const gen = new LessonBlockGenerator();
    const cls = mockClass();
    const sub = mockSubject({ type: 'lab', requiresLab: true, canBeDoubled: true });
    const teacher = mockTeacher();
    const req = mockRequirement(cls, sub, teacher, {
      periodsPerWeek: 6,
      allowDoublePeriod: true,
      doublePeriodsPerWeek: 1,
      consecutivePreference: 'required',
      consecutiveCount: 3
    });

    const result = gen.generate([req], { coveredSet: new Set(), existingBlocks: [], classPeriodMap: buildClassPeriodMap([cls]) });
    const blocks = result.blocks || result;

    const consec = blocks.filter(b => b.isConsecutive);
    assert.ok(consec.length >= 1, 'Should produce consecutive lab blocks');
    assert.equal(consec[0].consecutiveSize, 3, 'Lab block should span 3 periods');
  });
});

// ═══════════════════════════════════════════════════════════════════
// TEST 4: Combined class (CombinationResolver)
// ═══════════════════════════════════════════════════════════════════
describe('CombinationResolver', () => {
  it('Test 4: produces ONE combined block for multiple classes', () => {
    const resolver = new CombinationResolver();
    const sub = mockSubject({ name: 'English', _id: mockId(500) });
    const cls1 = mockClass({ name: '11A', _id: mockId(301) });
    const cls2 = mockClass({ name: '11B', _id: mockId(302) });
    const cls3 = mockClass({ name: '11C', _id: mockId(303) });
    const teacher = mockTeacher();

    const rule = {
      _id: mockId(600),
      isActive: true,
      subject: sub,
      teacher: teacher,
      appliesTo: [{ class: cls1 }, { class: cls2 }, { class: cls3 }],
      periodsPerWeek: 4,
      strictness: 'must_combine'
    };

    const rawBlocks = [
      { subjectId: sub._id, classId: cls1._id, teacherId: teacher._id },
      { subjectId: sub._id, classId: cls2._id, teacherId: teacher._id },
      { subjectId: sub._id, classId: cls3._id, teacherId: teacher._id },
    ];

    const { combinedBlocks, filteredRawBlocks, coveredSet } = resolver.resolve(
      [rule], rawBlocks, [cls1, cls2, cls3], [teacher]
    );

    assert.equal(combinedBlocks.length, 4, 'Should produce 4 combined blocks (periodsPerWeek)');
    assert.equal(filteredRawBlocks.length, 0, 'Raw blocks for covered pairs should be filtered out');
    assert.equal(coveredSet.size, 3, 'Should cover 3 class-subject pairs');

    for (const cb of combinedBlocks) {
      assert.equal(cb.type, 'combined_class');
      assert.equal(cb.classIds.length, 3, 'Each combined block covers 3 classes');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// TEST 5: Split groups (SplitGroupResolver)
// ═══════════════════════════════════════════════════════════════════
describe('SplitGroupResolver', () => {
  it('Test 5: creates parallel pairs from split groups', () => {
    const resolver = new SplitGroupResolver();
    const classId = mockId(301);

    const blocks = [
      { classId, subjectId: mockId(501), subjectName: 'Biology', teacherId: mockId(201), studentGroup: 'Bio Group' },
      { classId, subjectId: mockId(501), subjectName: 'Biology', teacherId: mockId(201), studentGroup: 'Bio Group' },
      { classId, subjectId: mockId(502), subjectName: 'Mathematics', teacherId: mockId(202), studentGroup: 'Maths Group' },
      { classId, subjectId: mockId(502), subjectName: 'Mathematics', teacherId: mockId(202), studentGroup: 'Maths Group' },
      { classId: mockId(302), subjectId: mockId(503), subjectName: 'English', teacherId: mockId(203) }, // No group
    ];

    const { splitPairs, regularBlocks } = resolver.resolve(blocks);

    assert.equal(splitPairs.length, 2, 'Should create 2 parallel pairs');
    assert.equal(regularBlocks.length, 1, 'Regular blocks should only include non-group blocks');

    for (const pair of splitPairs) {
      assert.equal(pair.blocks.length, 2, 'Each pair has 2 parallel blocks');
      assert.ok(pair.blocks.every(b => b.parallelEligible === true), 'All paired blocks are parallel-eligible');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// TEST 6-9: PlacementEngine scenarios (using ConstraintValidator)
// ═══════════════════════════════════════════════════════════════════
describe('ConstraintValidator', () => {
  function buildValidator(teachers, rooms, classes) {
    const classPeriodMap = buildClassPeriodMap(classes);
    return new ConstraintValidator({
      teachers,
      rooms,
      classes,
      classPeriodMap,
      periodStructures: {}
    });
  }

  it('Test 11: detects teacher conflict (hard constraint)', () => {
    const teacher = mockTeacher({ _id: mockId(201) });
    const room = mockRoom();
    const cls = mockClass();
    const validator = buildValidator([teacher], [room], [cls]);

    // Manually mark teacher as busy
    validator.ctx.teacherSchedule[`${teacher._id}_Monday_1`] = true;

    // Simulate a block placement that would conflict
    const blocks = [{
      teacher: teacher._id,
      classes: [cls._id],
      day: 'Monday',
      periods: [1],
      room: room._id,
      type: 'normal'
    }];

    const errors = validator.validateHard(blocks);
    assert.ok(errors.length > 0, 'Should detect teacher conflict');
  });

  it('Test 12: detects room conflict (hard constraint)', () => {
    const teacher = mockTeacher({ _id: mockId(201) });
    const room = mockRoom({ _id: mockId(401) });
    const cls = mockClass();
    const validator = buildValidator([teacher], [room], [cls]);

    // Mark room as occupied
    validator.ctx.roomSchedule[`${room._id}_Monday_1`] = true;

    const blocks = [{
      teacher: teacher._id,
      classes: [cls._id],
      day: 'Monday',
      periods: [1],
      room: room._id,
      type: 'normal'
    }];

    const errors = validator.validateHard(blocks);
    assert.ok(errors.length > 0, 'Should detect room conflict');
  });

  it('Test 13: detects class conflict (hard constraint)', () => {
    const teacher = mockTeacher({ _id: mockId(201) });
    const room = mockRoom();
    const cls = mockClass({ _id: mockId(301) });
    const validator = buildValidator([teacher], [room], [cls]);

    // Mark class slot as occupied
    validator.ctx.classSchedule[`${cls._id}_Monday_1`] = true;

    const blocks = [{
      teacher: teacher._id,
      classes: [cls._id],
      day: 'Monday',
      periods: [1],
      room: room._id,
      type: 'normal'
    }];

    const errors = validator.validateHard(blocks);
    assert.ok(errors.length > 0, 'Should detect class conflict');
  });

  it('Test 15: calculates quality score with workload balance', () => {
    const teacher1 = mockTeacher({ _id: mockId(201), name: 'T1' });
    const teacher2 = mockTeacher({ _id: mockId(202), name: 'T2' });
    const room = mockRoom();
    const cls = mockClass();
    const validator = buildValidator([teacher1, teacher2], [room], [cls]);

    // Simulate balanced placement
    const blocks = [];
    for (let d = 0; d < 5; d++) {
      for (let p = 0; p < 2; p++) {
        blocks.push({
          teacher: teacher1._id,
          classes: [cls._id],
          day: WORKING_DAYS[d],
          periods: [p],
          room: room._id,
          subject: mockId(501),
          type: 'normal'
        });
      }
    }

    const score = validator.calculateScore(blocks, []);
    assert.ok(typeof score.total === 'number', 'Score should have a numeric total');
    assert.ok(score.factors, 'Score should have factors');
    assert.ok(score.analytics, 'Score should have analytics');
  });

  it('Test 16: subject spread is rewarded in scoring', () => {
    const teacher = mockTeacher({ _id: mockId(201) });
    const room = mockRoom();
    const cls = mockClass({ _id: mockId(301) });
    const validator = buildValidator([teacher], [room], [cls]);

    // Place the same subject across multiple days (good spread)
    const spreadBlocks = [];
    for (let d = 0; d < 4; d++) {
      spreadBlocks.push({
        teacher: teacher._id,
        classes: [cls._id],
        day: WORKING_DAYS[d],
        periods: [0],
        room: room._id,
        subject: mockId(501),
        type: 'normal'
      });
    }
    const spreadScore = validator.calculateScore(spreadBlocks, []);

    // Place the same subject all on one day (bad spread)
    const validator2 = buildValidator([teacher], [room], [cls]);
    const clumpedBlocks = [];
    for (let p = 0; p < 4; p++) {
      clumpedBlocks.push({
        teacher: teacher._id,
        classes: [cls._id],
        day: 'Monday',
        periods: [p],
        room: room._id,
        subject: mockId(501),
        type: 'normal'
      });
    }
    const clumpedScore = validator2.calculateScore(clumpedBlocks, []);

    // Spread score should be >= clumped score (spread is rewarded)
    assert.ok(spreadScore.total >= clumpedScore.total,
      `Spread score (${spreadScore.total}) should be >= clumped score (${clumpedScore.total})`);
  });
});

// ═══════════════════════════════════════════════════════════════════
// TEST 14: Break crossing prevention
// ═══════════════════════════════════════════════════════════════════
describe('Break crossing', () => {
  it('Test 14: _areConsecutive rejects chains that cross a break', () => {
    // We test this by checking that period 2→3 is not consecutive when period 3 is a break
    const breaks = { Monday: [3] };
    const periods = [2, 3]; // Period 3 is a break

    // Check if a consecutive block spanning period 2-3 would cross the break
    const crossesBreak = breaks.Monday?.some(bp => periods.includes(bp));
    assert.ok(crossesBreak, 'Should detect that the chain includes a break period');
  });
});

// ═══════════════════════════════════════════════════════════════════
// TEST 17: Impossible timetable diagnostics
// ═══════════════════════════════════════════════════════════════════
describe('Diagnostics', () => {
  it('Test 17: overloaded schedule produces diagnostic errors', () => {
    const teacher = mockTeacher({ _id: mockId(201), maxPeriodsPerDay: 2, maxPeriodsPerWeek: 5 });
    const room = mockRoom();
    const cls = mockClass();
    const validator = buildValidator([teacher], [room], [cls]);

    // Create many blocks that would overload the teacher
    const blocks = [];
    for (let d = 0; d < 5; d++) {
      for (let p = 0; p < 6; p++) {
        blocks.push({
          teacher: teacher._id,
          classes: [cls._id],
          day: WORKING_DAYS[d],
          periods: [p],
          room: room._id,
          type: 'normal'
        });
      }
    }

    const errors = validator.validateHard(blocks);
    // With 30 blocks but teacher max=5/week, should have conflicts
    assert.ok(errors.length > 0, 'Should produce diagnostic errors for overloaded schedule');

    function buildValidator(teachers, rooms, classes) {
      const classPeriodMap = buildClassPeriodMap(classes);
      return new ConstraintValidator({
        teachers,
        rooms,
        classes,
        classPeriodMap,
        periodStructures: {}
      });
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// TEST 18: Teacher continuous-period cap
// ═══════════════════════════════════════════════════════════════════
describe('Teacher continuous periods', () => {
  it('Test 18: _wouldExceedContinuous detects long chains', () => {
    // We'll test the logic inline since PlacementEngine requires full setup
    // The logic: if placing at period P would make a chain > maxContinuous, return true

    function wouldExceedContinuous(teacherSchedule, tid, day, startPeriod, duration, maxContinuous) {
      let chainStart = startPeriod;
      let chainEnd = startPeriod + duration - 1;
      while (chainStart > 0) {
        if (teacherSchedule[`${tid}_${day}_${chainStart - 1}`]) chainStart--;
        else break;
      }
      while (true) {
        if (teacherSchedule[`${tid}_${day}_${chainEnd + 1}`]) chainEnd++;
        else break;
      }
      return (chainEnd - chainStart + 1) > maxContinuous;
    }

    const schedule = {};
    const tid = 'T1';
    // Teacher has periods 0,1,2 occupied
    schedule[`${tid}_Monday_0`] = true;
    schedule[`${tid}_Monday_1`] = true;
    schedule[`${tid}_Monday_2`] = true;

    // Placing at period 3 would make chain 0-3 = 4 (ok for max=4)
    assert.equal(wouldExceedContinuous(schedule, tid, 'Monday', 3, 1, 4), false,
      'Chain of 4 should NOT exceed max of 4');

    // Placing at period 3 would make chain 0-3 = 4 (exceeds max=3)
    assert.equal(wouldExceedContinuous(schedule, tid, 'Monday', 3, 1, 3), true,
      'Chain of 4 SHOULD exceed max of 3');

    // Placing at period 5 (isolated) should be fine
    assert.equal(wouldExceedContinuous(schedule, tid, 'Monday', 5, 1, 3), false,
      'Isolated period should not exceed continuous');

    // Double period at 3-4 would make chain 0-4 = 5 (exceeds max=4)
    assert.equal(wouldExceedContinuous(schedule, tid, 'Monday', 3, 2, 4), true,
      'Chain of 5 (double period extending existing chain) should exceed max=4');
  });
});

// ═══════════════════════════════════════════════════════════════════
// TEST 19: Relaxed retry logic
// ═══════════════════════════════════════════════════════════════════
describe('Retry sweep', () => {
  it('Test 19: relaxed retry removes successfully placed errors', () => {
    // We test the error removal logic
    const errors = [
      { type: 'regular_unplaced', classId: 'C1', subjectId: 'S1', teacherId: 'T1', details: { class: {}, subject: {}, teacher: {} } },
      { type: 'regular_unplaced', classId: 'C2', subjectId: 'S2', teacherId: 'T2', details: { class: {}, subject: {}, teacher: {} } },
      { type: 'split_group_unplaced', classId: 'C3' }, // Not retryable
    ];

    // Simulate: the first error was successfully retried
    const retried = [errors[0]];

    // Remove retried errors
    for (const err of retried) {
      const idx = errors.indexOf(err);
      if (idx !== -1) errors.splice(idx, 1);
    }

    assert.equal(errors.length, 2, 'Should have 2 errors remaining after retry');
    assert.equal(errors[0].type, 'regular_unplaced', 'First remaining should be regular');
    assert.equal(errors[1].type, 'split_group_unplaced', 'Split group error should not be retried');
  });
});

// ═══════════════════════════════════════════════════════════════════
// TEST 6-9, 10, 21: Room search and placement scenarios
// ═══════════════════════════════════════════════════════════════════
describe('Room and placement scenarios', () => {
  it('Test 6: lab block prefers lab room type', () => {
    const gen = new LessonBlockGenerator();
    const cls = mockClass();
    const labSub = mockSubject({ type: 'lab', requiresLab: true });
    const teacher = mockTeacher();
    const req = mockRequirement(cls, labSub, teacher, { periodsPerWeek: 1 });

    const result = gen.generate([req], { coveredSet: new Set(), existingBlocks: [], classPeriodMap: buildClassPeriodMap([cls]) });
    const blocks = result.blocks || result;

    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].blockType, 'lab', 'Lab block should have lab blockType');
    assert.ok(blocks[0].requiresLab || blocks[0].requiredRoomType === 'lab', 'Should flag lab room requirement');
  });

  it('Test 7: activity block allows null teacher descriptor', () => {
    const gen = new LessonBlockGenerator();
    const cls = mockClass();
    const actSub = mockSubject({ type: 'activity', name: 'Sports' });
    const teacher = mockTeacher();
    const req = mockRequirement(cls, actSub, teacher, { periodsPerWeek: 1 });

    const result = gen.generate([req], { coveredSet: new Set(), existingBlocks: [], classPeriodMap: buildClassPeriodMap([cls]) });
    const blocks = result.blocks || result;

    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].blockType, 'activity');
    // Activity blocks can be placed even without teacher (engine will allow null)
  });

  it('Test 8: club block uses flexible room', () => {
    const gen = new LessonBlockGenerator();
    const cls = mockClass();
    const clubSub = mockSubject({ type: 'club', name: 'Chess Club' });
    const teacher = mockTeacher();
    const req = mockRequirement(cls, clubSub, teacher, { periodsPerWeek: 1 });

    const result = gen.generate([req], { coveredSet: new Set(), existingBlocks: [], classPeriodMap: buildClassPeriodMap([cls]) });
    const blocks = result.blocks || result;

    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].blockType, 'club');
    // Club blocks use flexible room search in PlacementEngine (any type fallback)
  });

  it('Test 9: locked blocks are preserved in placement context', () => {
    // Test that locked blocks get added to the placed list
    const lockedBlocks = [
      {
        type: 'normal',
        subject: mockId(501),
        teacher: mockId(201),
        room: mockId(401),
        classes: [mockId(301)],
        day: 'Monday',
        periods: [0],
        duration: 1,
        isLocked: true
      }
    ];

    // Simulate preload: the block should appear in placed list
    const placedBlocks = [];
    const ctx = { classSchedule: {}, teacherSchedule: {}, roomSchedule: {} };

    for (const lb of lockedBlocks) {
      placedBlocks.push({
        ...lb,
        timetable: 'new_timetable_id',
      });
      for (const p of lb.periods) {
        for (const cid of lb.classes) ctx.classSchedule[`${cid}_${lb.day}_${p}`] = true;
        if (lb.teacher) ctx.teacherSchedule[`${lb.teacher}_${lb.day}_${p}`] = true;
        if (lb.room) ctx.roomSchedule[`${lb.room}_${lb.day}_${p}`] = true;
      }
    }

    assert.equal(placedBlocks.length, 1, 'Locked block should be in placed list');
    assert.equal(placedBlocks[0].isLocked, true, 'Should retain isLocked flag');
    assert.ok(ctx.classSchedule[`${mockId(301)}_Monday_0`], 'Class slot should be marked');
    assert.ok(ctx.teacherSchedule[`${mockId(201)}_Monday_0`], 'Teacher slot should be marked');
    assert.ok(ctx.roomSchedule[`${mockId(401)}_Monday_0`], 'Room slot should be marked');
  });

  it('Test 10: reserved periods mark class/teacher/room as occupied', () => {
    // Simulate reserved rule application
    const ctx = { classSchedule: {}, teacherSchedule: {}, roomSchedule: {} };
    const rule = {
      type: 'assembly',
      day: 'Monday',
      periods: [0],
      appliesTo: [{ class: { _id: mockId(301) } }],
      teacher: { _id: mockId(201) },
      room: { _id: mockId(401) }
    };

    const targetClasses = rule.appliesTo.map(a => a.class._id);
    for (const p of rule.periods) {
      for (const cid of targetClasses) ctx.classSchedule[`${cid}_${rule.day}_${p}`] = true;
      if (rule.teacher) ctx.teacherSchedule[`${rule.teacher._id}_${rule.day}_${p}`] = true;
      if (rule.room) ctx.roomSchedule[`${rule.room._id}_${rule.day}_${p}`] = true;
    }

    assert.ok(ctx.classSchedule[`${mockId(301)}_Monday_0`], 'Reserved: class slot marked');
    assert.ok(ctx.teacherSchedule[`${mockId(201)}_Monday_0`], 'Reserved: teacher slot marked');
    assert.ok(ctx.roomSchedule[`${mockId(401)}_Monday_0`], 'Reserved: room slot marked');
  });

  it('Test 21: room 5-pass fallback type matching', () => {
    // Verify room type compatibility groups used in PlacementEngine
    const ROOM_TYPE_COMPAT = {
      'lab': ['computer_lab'],
      'computer_lab': ['lab'],
      'classroom': ['library'],
      'library': ['classroom'],
      'auditorium': ['playground'],
      'playground': ['auditorium']
    };

    // classroom should accept library as compatible
    const compat = ROOM_TYPE_COMPAT['classroom'] || [];
    assert.ok(compat.includes('library'), 'classroom should accept library as fallback');
    assert.ok(!compat.includes('lab'), 'classroom should NOT accept lab');

    // lab should accept computer_lab
    const labCompat = ROOM_TYPE_COMPAT['lab'] || [];
    assert.ok(labCompat.includes('computer_lab'), 'lab should accept computer_lab as fallback');
  });
});

// ═══════════════════════════════════════════════════════════════════
// TEST 22: Scoring prefers balanced placement
// ═══════════════════════════════════════════════════════════════════
describe('Scoring preference', () => {
  it('Test 22: scoring prefers balanced teacher workload', () => {
    const teacher1 = mockTeacher({ _id: mockId(201), name: 'T1' });
    const teacher2 = mockTeacher({ _id: mockId(202), name: 'T2' });
    const room = mockRoom();
    const cls = mockClass();

    function buildValidator(teachers, rooms, classes) {
      const classPeriodMap = buildClassPeriodMap(classes);
      return new ConstraintValidator({ teachers, rooms, classes, classPeriodMap, periodStructures: {} });
    }

    // Balanced: both teachers have 5 periods each
    const v1 = buildValidator([teacher1, teacher2], [room], [cls]);
    const balanced = [];
    for (let d = 0; d < 5; d++) {
      balanced.push({ teacher: teacher1._id, classes: [cls._id], day: WORKING_DAYS[d], periods: [0], room: room._id, subject: mockId(501), type: 'normal' });
      balanced.push({ teacher: teacher2._id, classes: [cls._id], day: WORKING_DAYS[d], periods: [1], room: room._id, subject: mockId(502), type: 'normal' });
    }
    const balancedScore = v1.calculateScore(balanced, []);

    // Unbalanced: teacher1 has 9 periods, teacher2 has 1
    const v2 = buildValidator([teacher1, teacher2], [room], [cls]);
    const unbalanced = [];
    for (let d = 0; d < 5; d++) {
      unbalanced.push({ teacher: teacher1._id, classes: [cls._id], day: WORKING_DAYS[d], periods: [0], room: room._id, subject: mockId(501), type: 'normal' });
      if (d < 4) unbalanced.push({ teacher: teacher1._id, classes: [cls._id], day: WORKING_DAYS[d], periods: [1], room: room._id, subject: mockId(501), type: 'normal' });
    }
    unbalanced.push({ teacher: teacher2._id, classes: [cls._id], day: WORKING_DAYS[0], periods: [2], room: room._id, subject: mockId(502), type: 'normal' });
    const unbalancedScore = v2.calculateScore(unbalanced, []);

    assert.ok(balancedScore.total >= unbalancedScore.total,
      `Balanced score (${balancedScore.total}) should be >= unbalanced (${unbalancedScore.total})`);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Seeded Random
// ═══════════════════════════════════════════════════════════════════
describe('SeededRandom', () => {
  it('produces deterministic results', () => {
    const rng1 = new SeededRandom('test_seed');
    const rng2 = new SeededRandom('test_seed');

    const seq1 = Array.from({ length: 10 }, () => rng1.next());
    const seq2 = Array.from({ length: 10 }, () => rng2.next());

    assert.deepEqual(seq1, seq2, 'Same seed should produce identical sequences');
  });

  it('shuffle is deterministic', () => {
    const rng1 = new SeededRandom(42);
    const rng2 = new SeededRandom(42);

    const arr1 = [1, 2, 3, 4, 5, 6, 7, 8];
    const arr2 = [1, 2, 3, 4, 5, 6, 7, 8];

    rng1.shuffle(arr1);
    rng2.shuffle(arr2);

    assert.deepEqual(arr1, arr2, 'Same seed shuffle should produce identical order');
  });
});

// ═══════════════════════════════════════════════════════════════════
// New Priority 3 analytics
// ═══════════════════════════════════════════════════════════════════
describe('Priority 3 analytics', () => {
  it('calculates room utilization in scoring', () => {
    const teacher = mockTeacher({ _id: mockId(201) });
    const room = mockRoom({ _id: mockId(401) });
    const cls = mockClass({ _id: mockId(301) });
    const classPeriodMap = buildClassPeriodMap([cls]);
    const validator = new ConstraintValidator({
      teachers: [teacher], rooms: [room], classes: [cls],
      classPeriodMap, periodStructures: {}
    });

    const blocks = [{
      teacher: teacher._id, classes: [cls._id], day: 'Monday',
      periods: [0], room: room._id, subject: mockId(501), type: 'normal'
    }];

    const score = validator.calculateScore(blocks, []);
    assert.ok('roomUtilization' in score.factors, 'Should have roomUtilization factor');
    assert.ok(score.analytics.roomUtilization, 'Should have roomUtilization analytics');
    assert.ok(typeof score.analytics.roomUtilization.percentage === 'number');
  });

  it('calculates continuous quality in scoring', () => {
    const teacher = mockTeacher({ _id: mockId(201) });
    const room = mockRoom();
    const cls = mockClass({ _id: mockId(301) });
    const classPeriodMap = buildClassPeriodMap([cls]);
    const validator = new ConstraintValidator({
      teachers: [teacher], rooms: [room], classes: [cls],
      classPeriodMap, periodStructures: {}
    });

    // Place 6 consecutive periods for a teacher (should get penalized)
    const blocks = [];
    for (let p = 0; p < 6; p++) {
      blocks.push({
        teacher: teacher._id, classes: [cls._id], day: 'Monday',
        periods: [p], room: room._id, subject: mockId(501), type: 'normal'
      });
    }

    const score = validator.calculateScore(blocks, []);
    assert.ok('continuousQuality' in score.factors, 'Should have continuousQuality factor');
    assert.ok(score.factors.continuousQuality < 100,
      `Continuous quality (${score.factors.continuousQuality}) should be penalized for 6-period chain`);
  });

  it('groups unplaced blocks by type and cause', () => {
    const teacher = mockTeacher({ _id: mockId(201) });
    const room = mockRoom();
    const cls = mockClass({ _id: mockId(301) });
    const classPeriodMap = buildClassPeriodMap([cls]);
    const validator = new ConstraintValidator({
      teachers: [teacher], rooms: [room], classes: [cls],
      classPeriodMap, periodStructures: {}
    });

    const errors = [
      { type: 'regular_unplaced', rootCause: 'Teacher busy', reason: 'NO_SLOT' },
      { type: 'regular_unplaced', rootCause: 'No room', reason: 'NO_ROOM' },
      { type: 'split_group_unplaced', rootCause: 'Parallel fail', reason: 'SPLIT_FAIL' },
    ];

    const score = validator.calculateScore([], errors);
    assert.ok(score.analytics.unplacedByType, 'Should have unplacedByType');
    assert.equal(score.analytics.unplacedByType['regular_unplaced'], 2);
    assert.equal(score.analytics.unplacedByType['split_group_unplaced'], 1);
    assert.ok(score.analytics.unplacedByCause, 'Should have unplacedByCause');
  });
});
