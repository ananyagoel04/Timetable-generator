const LessonBlock = require('../models/LessonBlock');
const GeneratedTimetable = require('../models/GeneratedTimetable');
const SubjectRequirement = require('../models/SubjectRequirement');
const SubjectCombinationRule = require('../models/SubjectCombinationRule');
const ReservedPeriodRule = require('../models/ReservedPeriodRule');
const PeriodStructure = require('../models/PeriodStructure');
const CustomRule = require('../models/CustomRule');
const SoftPreference = require('../models/SoftPreference');
const CanTeach = require('../models/CanTeach');
const Class = require('../models/Class');
const Room = require('../models/Room');
const Teacher = require('../models/Teacher');
const School = require('../models/School');
const ConflictLog = require('../models/ConflictLog');
const mongoose = require('mongoose');

// Pipeline modules
const SeededRandom = require('./engine/SeededRandom');
const LessonBlockGenerator = require('./engine/LessonBlockGenerator');
const CombinationResolver = require('./engine/CombinationResolver');
const SplitGroupResolver = require('./engine/SplitGroupResolver');
const ConstraintValidator = require('./engine/ConstraintValidator');
const PlacementEngine = require('./engine/PlacementEngine');

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

class SchedulerEngine {
  constructor(schoolId, sessionId) {
    this.schoolId = schoolId;
    this.sessionId = sessionId;
    this.school = null;
    this.classes = [];
    this.rooms = [];
    this.teachers = [];
    this.requirements = [];
    this.combinationRules = [];
    this.reservedRules = [];
    this.customRules = [];
    this.softPreferences = [];
    this.canTeachMappings = [];
    this.classPeriodMap = {};
    this.defaultPeriodStructure = null;

    // Shared scheduling state
    this.teacherSchedule = {};
    this.roomSchedule = {};
    this.classSchedule = {};
    this.teacherDayCount = {};
    this.teacherWeekCount = {};
    this.classDaySubjectCount = {};

    this.errors = [];
    this.blocks = [];
    this.timetable = null;
    this.score = { hard: 0, soft: 0, total: 0, factors: {} };
    this.generationOptions = {};

    // Progress callback (used by GenerationJob)
    this.onProgress = () => {};
  }

  /**
   * Main generation entry point — orchestrates the 5-stage pipeline.
   * @param {Object} options
   * @param {string} options.seed - Optional seed for deterministic generation
   */
  async generate(options = {}) {
    const startTime = Date.now();

    // ═══ 1. LOAD ALL DATA ═══
    this.onProgress('loading', 0);
    await this._loadData();

    // ═══ 2. RESOLVE PER-CLASS PERIOD STRUCTURES ═══
    this.onProgress('period_structures', 5);
    await this._resolvePeriodStructures();

    // ═══ 3. CREATE TIMETABLE RECORD ═══
    this.timetable = await GeneratedTimetable.create({
      school: this.schoolId,
      session: this.sessionId,
      name: `Timetable v${Date.now()}`,
      status: 'generating',
      generatedAt: new Date()
    });

    // ═══ 4. INITIALIZE PIPELINE ═══
    this.onProgress('pipeline_init', 10);
    const seed = options.seed || SeededRandom.createSeed(this.schoolId, this.sessionId);
    const rng = new SeededRandom(seed);

    // Stage 2: CombinationResolver — build coverage set + combined blocks
    const combinationResolver = new CombinationResolver();
    const coveredSet = combinationResolver.buildCoveredSet(this.combinationRules);

    // Stage 1: LessonBlockGenerator — create raw block descriptors
    this.onProgress('generating_blocks', 15);
    const blockGenerator = new LessonBlockGenerator();
    const rawResult = blockGenerator.generate(this.requirements, {
      coveredSet,
      existingBlocks: [],
      classPeriodMap: this.classPeriodMap,
      teachers: this.teachers
    });
    const rawBlocks = rawResult.blocks || rawResult; // backward-compat
    if (rawResult.warnings?.length > 0) {
      console.warn('[SchedulerEngine] Block generation warnings:', rawResult.warnings);
    }

    // Stage 2 continued: resolve combinations + deduplicate
    const { combinedBlocks, filteredRawBlocks } = combinationResolver.resolve(
      this.combinationRules, rawBlocks, this.classes, this.teachers
    );

    // Stage 2b: SplitGroupResolver — identify parallel group pairs
    this.onProgress('resolving_groups', 20);
    const splitGroupResolver = new SplitGroupResolver();
    const { splitPairs, regularBlocks } = splitGroupResolver.resolve(filteredRawBlocks);

    // Stage 3: ConstraintValidator — create validator with shared context
    const validatorContext = {
      teacherSchedule: this.teacherSchedule,
      roomSchedule: this.roomSchedule,
      classSchedule: this.classSchedule,
      teacherDayCount: this.teacherDayCount,
      teacherWeekCount: this.teacherWeekCount,
      classDaySubjectCount: this.classDaySubjectCount,
      teachers: this.teachers,
      rooms: this.rooms,
      customRules: this.customRules,
      canTeachMappings: this.canTeachMappings,
      classPeriodMap: this.classPeriodMap
    };
    const validator = new ConstraintValidator(validatorContext);

    // Stage 4: PlacementEngine — assign blocks to timeslots
    this.onProgress('placing', 25);

    // Load locked blocks from the latest published timetable (Priority 3)
    let lockedBlocks = [];
    if (this.generationOptions.lockedBlockIds?.length > 0) {
      lockedBlocks = await LessonBlock.find({
        _id: { $in: this.generationOptions.lockedBlockIds },
        isLocked: true
      }).lean();
    } else if (this.generationOptions.keepLockedBlocks) {
      // Auto-load from latest published timetable
      const latestPublished = await GeneratedTimetable.findOne({
        school: this.schoolId,
        session: this.sessionId,
        status: 'published'
      }).sort({ publishedAt: -1 });
      if (latestPublished) {
        lockedBlocks = await LessonBlock.find({
          timetable: latestPublished._id,
          isLocked: true
        }).lean();
      }
    }

    const placementEngine = new PlacementEngine({
      validator,
      classPeriodMap: this.classPeriodMap,
      rooms: this.rooms,
      classes: this.classes,
      teachers: this.teachers,
      school: this.school,
      rng,
      onProgress: (stage, percent) => this.onProgress(stage, percent)
    });

    const { placedBlocks, errors } = placementEngine.place({
      reservedRules: this.reservedRules,
      combinedBlocks,
      splitPairs,
      regularBlocks,
      timetableId: this.timetable._id,
      lockedBlocks
    });

    this.blocks = placedBlocks;
    this.errors = errors;

    // ═══ 5. SAVE ALL BLOCKS ═══
    this.onProgress('saving', 92);
    if (this.blocks.length > 0) {
      await LessonBlock.insertMany(this.blocks, { ordered: false }).catch(err => {
        console.error('[SchedulerEngine] Block save error:', err.message);
      });
    }

    // ═══ 6. CONFLICT DETECTION ═══
    this.onProgress('conflicts', 95);
    const conflicts = await this._detectConflicts();

    // ═══ 7. QUALITY SCORING ═══
    this.onProgress('scoring', 98);
    this.score = validator.calculateScore(this.blocks, this.errors, this.softPreferences, this.school);

    // ═══ 8. UPDATE TIMETABLE STATS ═══
    const elapsed = Date.now() - startTime;
    this.timetable.stats = {
      totalBlocks: this.blocks.length,
      placedBlocks: this.blocks.length - this.errors.length,
      unplacedBlocks: this.errors.length,
      hardConflicts: conflicts.length,
      softRuleScore: this.score.total,
      generationTimeMs: elapsed,
      seed
    };
    this.timetable.unplacedItems = this.errors.map(e => ({
      class: e.classId, subject: e.subjectId, teacher: e.teacherId, reason: e.message
    }));
    // Store full structured diagnostics
    this.timetable.diagnostics = {
      errors: this.errors.map(e => ({
        reason: e.reason,
        message: e.message,
        details: e.details,
        suggestions: e.suggestions,
        type: e.type
      })),
      analytics: this.score.analytics || {},
      factors: this.score.factors || {}
    };
    this.timetable.status = this.errors.length === 0 && conflicts.length === 0 ? 'draft' : 'review';
    await this.timetable.save();

    this.onProgress('complete', 100);

    return {
      timetableId: this.timetable._id,
      status: this.timetable.status,
      totalBlocks: this.blocks.length,
      unplaced: this.errors.length,
      conflicts: conflicts.length,
      unplacedDetails: this.errors,
      diagnostics: this.timetable.diagnostics,
      score: this.score,
      timeMs: elapsed
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // DATA LOADING
  // ═══════════════════════════════════════════════════════════════════
  async _loadData() {
    this.school = await School.findById(this.schoolId);
    if (!this.school) throw new Error('School not found');

    this.classes = await Class.find({ school: this.schoolId, session: this.sessionId, isActive: true })
      .populate('periodStructure');
    this.rooms = await Room.find({ school: this.schoolId, isAvailable: true });
    this.teachers = await Teacher.find({ school: this.schoolId, session: this.sessionId, status: 'active' });
    this.requirements = await SubjectRequirement.find({ school: this.schoolId, session: this.sessionId, isActive: true })
      .populate('subject teacher class');
    this.combinationRules = await SubjectCombinationRule.find({ school: this.schoolId, session: this.sessionId, isActive: true })
      .populate('subject teacher room appliesTo.class');
    this.reservedRules = await ReservedPeriodRule.find({ school: this.schoolId, session: this.sessionId, isActive: true })
      .populate('subject teacher room');
    this.customRules = await CustomRule.find({ school: this.schoolId, isActive: true });
    this.softPreferences = await SoftPreference.find({ school: this.schoolId, isActive: true });
    this.canTeachMappings = await CanTeach.find({ school: this.schoolId, session: this.sessionId, isActive: true });

    if (this.classes.length === 0) throw new Error('No classes found');
    if (this.rooms.length === 0) throw new Error('No rooms found');
  }

  // ═══════════════════════════════════════════════════════════════════
  // PERIOD STRUCTURE RESOLUTION (preserved from original)
  // ═══════════════════════════════════════════════════════════════════
  async _resolvePeriodStructures() {
    const allPS = await PeriodStructure.find({
      school: this.schoolId, session: this.sessionId, status: 'active'
    });

    this.defaultPeriodStructure = allPS.find(ps => {
      const hasNoAssignment = (!ps.assignedTo?.classes?.length &&
                               !ps.assignedTo?.grades?.length &&
                               !ps.assignedTo?.streams?.length &&
                               !ps.assignedTo?.shifts?.length);
      return hasNoAssignment || ps.templateType === 'default';
    }) || allPS[0];

    for (const cls of this.classes) {
      let ps = null;

      if (cls.periodStructure) {
        ps = typeof cls.periodStructure === 'object' ? cls.periodStructure :
             allPS.find(p => p._id.toString() === cls.periodStructure.toString());
      }
      if (!ps) ps = allPS.find(p => p.assignedTo?.classes?.some(c => c.toString() === cls._id.toString()));
      if (!ps) ps = allPS.find(p => p.assignedTo?.grades?.includes(cls.grade));
      if (!ps) ps = allPS.find(p => p.assignedTo?.streams?.includes(cls.stream));
      if (!ps) ps = allPS.find(p => p.assignedTo?.shifts?.includes(cls.shift));
      if (!ps) ps = this.defaultPeriodStructure;

      this.classPeriodMap[cls._id.toString()] = this._parsePeriodStructure(ps, cls);
    }
  }

  _parsePeriodStructure(ps, cls) {
    const result = {
      workingDays: [],
      daySlots: {},
      dayBreaks: {},
      dayTimeslotInfo: {},
      allTimeslots: [],
      allBreaks: []
    };

    if (!ps || !ps.timeslots?.length) {
      const workingDays = this.school.settings?.workingDays || DAYS;
      const totalPeriods = this.school.settings?.defaultPeriodsPerDay || 8;
      const breakPeriod = this.school.settings?.defaultBreakPeriod || 4;
      result.workingDays = workingDays;
      for (const day of workingDays) {
        result.daySlots[day] = [];
        result.dayBreaks[day] = [breakPeriod];
        result.dayTimeslotInfo[day] = [];
        for (let i = 1; i <= totalPeriods; i++) {
          if (i !== breakPeriod) result.daySlots[day].push(i);
          result.dayTimeslotInfo[day].push({ slotNumber: i, type: i === breakPeriod ? 'break' : 'period' });
        }
      }
      result.allTimeslots = result.daySlots[workingDays[0]] || [];
      result.allBreaks = [breakPeriod];
      return result;
    }

    result.workingDays = ps.workingDays?.length > 0
      ? ps.workingDays
      : (this.school.settings?.workingDays || DAYS);

    const defaultSlots = [];
    const defaultBreaks = [];
    const defaultTimeslotInfo = [];
    for (const slot of ps.timeslots) {
      defaultTimeslotInfo.push({
        slotNumber: slot.slotNumber, startTime: slot.startTime,
        endTime: slot.endTime, label: slot.label, type: slot.type
      });
      if (slot.isSchedulable && slot.type === 'period') {
        defaultSlots.push(slot.slotNumber);
      } else if (['break', 'lunch'].includes(slot.type)) {
        defaultBreaks.push(slot.slotNumber);
      }
    }

    for (const day of result.workingDays) {
      const override = ps.dayOverrides?.find(o => o.day === day);
      const isSaturday = day === 'Saturday';
      const satConfig = isSaturday && ps.saturdayConfig?.enabled && ps.saturdayConfig.timeslots?.length > 0
        ? ps.saturdayConfig : null;

      if (override?.timeslots?.length > 0) {
        result.daySlots[day] = [];
        result.dayBreaks[day] = [];
        result.dayTimeslotInfo[day] = [];
        for (const slot of override.timeslots) {
          result.dayTimeslotInfo[day].push({
            slotNumber: slot.slotNumber, startTime: slot.startTime,
            endTime: slot.endTime, label: slot.label, type: slot.type
          });
          if (slot.isSchedulable && slot.type === 'period') result.daySlots[day].push(slot.slotNumber);
          else if (['break', 'lunch'].includes(slot.type)) result.dayBreaks[day].push(slot.slotNumber);
        }
      } else if (satConfig) {
        result.daySlots[day] = [];
        result.dayBreaks[day] = [];
        result.dayTimeslotInfo[day] = [];
        for (const slot of satConfig.timeslots) {
          result.dayTimeslotInfo[day].push({
            slotNumber: slot.slotNumber, startTime: slot.startTime,
            endTime: slot.endTime, label: slot.label, type: slot.type
          });
          if (slot.isSchedulable && slot.type === 'period') result.daySlots[day].push(slot.slotNumber);
          else if (['break', 'lunch'].includes(slot.type)) result.dayBreaks[day].push(slot.slotNumber);
        }
      } else {
        result.daySlots[day] = [...defaultSlots];
        result.dayBreaks[day] = [...defaultBreaks];
        result.dayTimeslotInfo[day] = [...defaultTimeslotInfo];
      }
    }

    result.allTimeslots = defaultSlots;
    result.allBreaks = defaultBreaks;
    return result;
  }

  // ═══════════════════════════════════════════════════════════════════
  // CONFLICT DETECTION (upgraded with grouping + suggestions)
  // ═══════════════════════════════════════════════════════════════════
  async _detectConflicts() {
    const blocks = await LessonBlock.find({ timetable: this.timetable._id })
      .populate('teacher classes subject room');
    const conflicts = [];
    const slotMap = {};

    for (const b of blocks) {
      if (b.type === 'reserved' && !b.subject) continue;
      for (const p of b.periods) {
        const key = `${b.day}_${p}`;
        if (!slotMap[key]) slotMap[key] = [];
        slotMap[key].push(b);
      }
    }

    for (const [key, slotBlocks] of Object.entries(slotMap)) {
      const [day, period] = key.split('_');

      // Teacher clashes
      const teacherMap = {};
      for (const b of slotBlocks) {
        if (!b.teacher) continue;
        const tid = b.teacher._id.toString();
        if (!teacherMap[tid]) teacherMap[tid] = [];
        teacherMap[tid].push(b);
      }
      for (const [tid, tBlocks] of Object.entries(teacherMap)) {
        if (tBlocks.length > 1) {
          const sameCombo = tBlocks.every(b => b.combinationRule &&
            b.combinationRule.toString() === tBlocks[0].combinationRule?.toString());
          if (!sameCombo) {
            conflicts.push(await ConflictLog.create({
              timetable: this.timetable._id,
              type: 'teacher_clash',
              severity: 'critical',
              day,
              period: parseInt(period),
              teacher: tid,
              classes: tBlocks.flatMap(b => b.classes),
              blocks: tBlocks.map(b => b._id),
              title: 'Teacher Double-Booked',
              message: `${tBlocks[0].teacher.name} is assigned to ${tBlocks.length} classes at ${day} Period ${period}`,
              suggestedFix: 'Move one lesson to a different period or assign a different teacher',
              suggestedFixes: [
                { action: 'swap_teacher', description: 'Assign a different teacher to one block', confidence: 70 },
                { action: 'move_to_period', description: 'Move one block to the next free period', confidence: 80 }
              ],
              groupId: `teacher_${tid}_${day}`,
              autoResolvable: true
            }));
          }
        }
      }

      // Room clashes
      const roomMap = {};
      for (const b of slotBlocks) {
        if (!b.room) continue;
        const rid = b.room._id.toString();
        if (!roomMap[rid]) roomMap[rid] = [];
        roomMap[rid].push(b);
      }
      for (const [rid, rBlocks] of Object.entries(roomMap)) {
        if (rBlocks.length > 1) {
          const sameCombo = rBlocks.every(b => b.combinationRule &&
            b.combinationRule.toString() === rBlocks[0].combinationRule?.toString());
          if (!sameCombo) {
            conflicts.push(await ConflictLog.create({
              timetable: this.timetable._id,
              type: 'room_clash',
              severity: 'high',
              day,
              period: parseInt(period),
              room: rid,
              classes: rBlocks.flatMap(b => b.classes),
              blocks: rBlocks.map(b => b._id),
              title: 'Room Double-Booked',
              message: `${rBlocks[0].room.name} has ${rBlocks.length} lessons at ${day} Period ${period}`,
              suggestedFix: 'Assign a different room to one of the lessons',
              suggestedFixes: [
                { action: 'change_room', description: 'Assign an alternate available room', confidence: 90 }
              ],
              groupId: `room_${rid}_${day}`,
              autoResolvable: true
            }));
          }
        }
      }

      // Class clashes
      const classMap = {};
      for (const b of slotBlocks) {
        for (const c of (b.classes || [])) {
          const cid = (c._id || c).toString();
          if (!classMap[cid]) classMap[cid] = [];
          classMap[cid].push(b);
        }
      }
      for (const [cid, cBlocks] of Object.entries(classMap)) {
        if (cBlocks.length > 1) {
          const allSameCombo = cBlocks.every(b => b.combinationRule &&
            b.combinationRule.toString() === cBlocks[0].combinationRule?.toString());
          const allSplitGroup = cBlocks.every(b => b.type === 'split_group');
          if (!allSameCombo && !allSplitGroup) {
            conflicts.push(await ConflictLog.create({
              timetable: this.timetable._id,
              type: 'class_clash',
              severity: 'critical',
              day,
              period: parseInt(period),
              classes: [cid],
              blocks: cBlocks.map(b => b._id),
              title: 'Class Double-Booked',
              message: `Class has ${cBlocks.length} lessons at ${day} Period ${period}`,
              suggestedFix: 'Remove one of the lessons or move to a different period',
              suggestedFixes: [
                { action: 'move_to_period', description: 'Move one block to a free period', confidence: 75 }
              ],
              groupId: `class_${cid}_${day}`,
              autoResolvable: false
            }));
          }
        }
      }
    }

    // Teacher overload detection
    const teacherDayTotals = {};
    for (const b of blocks) {
      if (!b.teacher) continue;
      const tid = b.teacher._id.toString();
      for (const p of b.periods) {
        const dk = `${tid}_${b.day}`;
        if (!teacherDayTotals[dk]) teacherDayTotals[dk] = { count: 0, tid, day: b.day, name: b.teacher.name };
        teacherDayTotals[dk].count++;
      }
    }
    for (const info of Object.values(teacherDayTotals)) {
      const teacher = this.teachers.find(t => t._id.toString() === info.tid);
      if (teacher && info.count > teacher.maxPeriodsPerDay) {
        conflicts.push(await ConflictLog.create({
          timetable: this.timetable._id,
          type: 'teacher_overload',
          severity: 'high',
          day: info.day,
          teacher: info.tid,
          title: 'Teacher Overloaded',
          message: `${info.name} has ${info.count} periods on ${info.day} (max: ${teacher.maxPeriodsPerDay})`,
          suggestedFix: 'Move some lessons to other days',
          suggestedFixes: [
            { action: 'move_to_period', description: `Redistribute lessons across other days`, confidence: 60 }
          ],
          groupId: `overload_${info.tid}`,
          autoResolvable: false
        }));
      }
    }

    // Unplaced lessons
    for (const err of this.errors) {
      conflicts.push(await ConflictLog.create({
        timetable: this.timetable._id,
        type: 'unassigned_lesson',
        severity: 'high',
        classes: err.classId ? [err.classId] : [],
        subject: err.subjectId,
        teacher: err.teacherId,
        title: 'Unplaced Lesson',
        message: err.message,
        suggestedFix: 'Ensure enough periods available, check teacher/room availability',
        suggestedFixes: [
          { action: 'move_to_period', description: 'Find any available slot', confidence: 50 }
        ],
        groupId: `unplaced_${err.classId || 'unknown'}`,
        autoResolvable: false
      }));
    }

    return conflicts;
  }
}

module.exports = SchedulerEngine;
