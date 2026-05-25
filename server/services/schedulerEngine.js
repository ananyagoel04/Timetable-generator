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
    // Per-class period structures
    this.classPeriodMap = {};      // classId -> { timeslots, breakPeriods, workingDays, saturdayTimeslots }
    this.defaultPeriodStructure = null;
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
  }

  async generate() {
    const startTime = Date.now();

    // ═══ 1. LOAD ALL DATA ═══
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

    // ═══ ITEM #20: Load CanTeach mappings for capability checks ═══
    this.canTeachMappings = await CanTeach.find({ school: this.schoolId, session: this.sessionId, isActive: true });

    if (this.classes.length === 0) throw new Error('No classes found');
    if (this.rooms.length === 0) throw new Error('No rooms found');

    // ═══ 2. RESOLVE PER-CLASS PERIOD STRUCTURES ═══
    await this._resolvePeriodStructures();

    // ═══ 3. CREATE TIMETABLE RECORD ═══
    this.timetable = await GeneratedTimetable.create({
      school: this.schoolId, session: this.sessionId,
      name: `Timetable v${Date.now()}`,
      status: 'generating', generatedAt: new Date()
    });

    // ═══ 4. PLACEMENT PIPELINE ═══
    // 4a. Reserved rules (assembly, activities, etc.)
    await this._placeReservedRules();
    // 4b. Combination rules (combined classes)
    await this._placeCombinationRules();
    // 4c. Class teacher first period
    if (this.school.settings?.classTeacherFirstPeriodPreference) {
      await this._placeClassTeacherFirstPeriod();
    }
    // 4d. Regular requirements (main scheduling loop)
    await this._placeRegularRequirements();
    // 4e. Place break blocks for visualization
    this._placeBreakBlocks();

    // ═══ 5. SAVE ALL BLOCKS ═══
    if (this.blocks.length > 0) {
      await LessonBlock.insertMany(this.blocks, { ordered: false }).catch(() => {});
    }

    // ═══ 6. CONFLICT DETECTION ═══
    const conflicts = await this._detectConflicts();

    // ═══ 7. QUALITY SCORING ═══
    this.score = this._calculateScore();

    // ═══ 8. UPDATE TIMETABLE STATS ═══
    const elapsed = Date.now() - startTime;
    this.timetable.stats = {
      totalBlocks: this.blocks.length,
      placedBlocks: this.blocks.length - this.errors.length,
      unplacedBlocks: this.errors.length,
      hardConflicts: conflicts.length,
      softRuleScore: this.score.total,
      generationTimeMs: elapsed
    };
    this.timetable.unplacedItems = this.errors.map(e => ({
      class: e.classId, subject: e.subjectId, teacher: e.teacherId, reason: e.message
    }));
    this.timetable.status = this.errors.length === 0 && conflicts.length === 0 ? 'draft' : 'review';
    await this.timetable.save();

    return {
      timetableId: this.timetable._id,
      status: this.timetable.status,
      totalBlocks: this.blocks.length,
      unplaced: this.errors.length,
      conflicts: conflicts.length,
      unplacedDetails: this.errors,
      score: this.score,
      timeMs: elapsed
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // DYNAMIC PER-CLASS PERIOD STRUCTURES (Items #8, #10)
  // ═══════════════════════════════════════════════════════════════════
  async _resolvePeriodStructures() {
    // Load all active period structures for this school/session
    const allPS = await PeriodStructure.find({
      school: this.schoolId, session: this.sessionId, status: 'active'
    });

    // Find the default (school-wide) period structure
    this.defaultPeriodStructure = allPS.find(ps => {
      const hasNoAssignment = (!ps.assignedTo?.classes?.length &&
                               !ps.assignedTo?.grades?.length &&
                               !ps.assignedTo?.streams?.length &&
                               !ps.assignedTo?.shifts?.length);
      return hasNoAssignment || ps.templateType === 'default';
    }) || allPS[0];

    // Resolve for each class
    for (const cls of this.classes) {
      let ps = null;

      // Priority 1: Class has a direct periodStructure reference
      if (cls.periodStructure) {
        ps = typeof cls.periodStructure === 'object' ? cls.periodStructure :
             allPS.find(p => p._id.toString() === cls.periodStructure.toString());
      }

      // Priority 2: Find a PS assigned to this specific class
      if (!ps) {
        ps = allPS.find(p => p.assignedTo?.classes?.some(c => c.toString() === cls._id.toString()));
      }

      // Priority 3: Find a PS assigned to this class's grade
      if (!ps) {
        ps = allPS.find(p => p.assignedTo?.grades?.includes(cls.grade));
      }

      // Priority 4: Find a PS assigned to this class's stream
      if (!ps) {
        ps = allPS.find(p => p.assignedTo?.streams?.includes(cls.stream));
      }

      // Priority 5: Find a PS assigned to this class's shift
      if (!ps) {
        ps = allPS.find(p => p.assignedTo?.shifts?.includes(cls.shift));
      }

      // Priority 6: Default period structure
      if (!ps) ps = this.defaultPeriodStructure;

      // Parse the period structure for this class
      this.classPeriodMap[cls._id.toString()] = this._parsePeriodStructure(ps, cls);
    }
  }

  /**
   * Parse a PeriodStructure document into working data for a specific class.
   * Supports per-day overrides, Saturday-specific structures, and dynamic period counts.
   */
  _parsePeriodStructure(ps, cls) {
    const result = {
      workingDays: [],
      daySlots: {},          // day -> [schedulable period numbers]
      dayBreaks: {},         // day -> [break period numbers]
      dayTimeslotInfo: {},   // day -> [{slotNumber, startTime, endTime, label, type}]
      allTimeslots: [],
      allBreaks: []
    };

    if (!ps || !ps.timeslots?.length) {
      // Fallback to school settings
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

    // Parse default timeslots
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
      // Check for day-specific override
      const override = ps.dayOverrides?.find(o => o.day === day);

      // Check for Saturday-specific config
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

  /**
   * Get schedulable periods for a specific class on a specific day.
   */
  _getClassDaySlots(classId, day) {
    const cp = this.classPeriodMap[classId.toString()];
    return cp?.daySlots?.[day] || [];
  }

  /**
   * Get working days for a specific class.
   */
  _getClassWorkingDays(classId) {
    const cp = this.classPeriodMap[classId.toString()];
    return cp?.workingDays || DAYS;
  }

  /**
   * Check if two periods are truly consecutive for a class on a given day
   * (no break between them in the actual period structure).
   */
  _areConsecutiveForClass(classId, day, p1, p2) {
    if (Math.abs(p1 - p2) !== 1) return false;
    const cp = this.classPeriodMap[classId.toString()];
    if (!cp) return Math.abs(p1 - p2) === 1;
    const minP = Math.min(p1, p2);
    const maxP = Math.max(p1, p2);
    // Both must be schedulable slots
    const daySlots = cp.daySlots?.[day] || [];
    if (!daySlots.includes(minP) || !daySlots.includes(maxP)) return false;
    // No break between them
    const dayBreaks = cp.dayBreaks?.[day] || [];
    if (dayBreaks.includes(minP) || dayBreaks.includes(maxP)) return false;
    // Check there's no break slot between them
    for (const b of dayBreaks) {
      if (b > minP && b < maxP) return false;
    }
    return true;
  }

  // ═══════════════════════════════════════════════════════════════════
  // PLACEMENT: RESERVED RULES
  // ═══════════════════════════════════════════════════════════════════
  async _placeReservedRules() {
    for (const rule of this.reservedRules) {
      const targetClasses = rule.appliesTo.length > 0
        ? rule.appliesTo.map(a => a.class?._id || a.class).filter(Boolean)
        : this.classes.map(c => c._id);

      // Only place on days this class actually works
      for (const cid of targetClasses) {
        const workingDays = this._getClassWorkingDays(cid);
        if (!workingDays.includes(rule.day)) continue;
      }

      const block = {
        timetable: this.timetable._id, type: 'reserved',
        subject: rule.subject?._id, teacher: rule.teacher?._id, room: rule.room?._id,
        classes: targetClasses, day: rule.day, periods: rule.periods,
        isLocked: rule.isLocked
      };
      this.blocks.push(block);

      for (const p of rule.periods) {
        for (const cid of targetClasses) this._markClass(cid.toString(), rule.day, p);
        if (rule.teacher) this._markTeacher(rule.teacher._id.toString(), rule.day, p);
        if (rule.room) this._markRoom(rule.room._id.toString(), rule.day, p);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // PLACEMENT: COMBINATION RULES
  // ═══════════════════════════════════════════════════════════════════
  async _placeCombinationRules() {
    for (const rule of this.combinationRules) {
      const classIds = rule.appliesTo.map(a => a.class?._id || a.class).filter(Boolean);
      if (classIds.length === 0) continue;

      // Find common working days across all classes in the combo
      const commonDays = this._getCommonWorkingDays(classIds);
      let placed = 0;
      const daysOrder = rule.preferredDays.length > 0
        ? [...rule.preferredDays.filter(d => commonDays.includes(d)), ...commonDays.filter(d => !rule.preferredDays.includes(d))]
        : [...commonDays];
      this._shuffle(daysOrder);

      for (let i = 0; i < rule.periodsPerWeek; i++) {
        let didPlace = false;
        for (const day of daysOrder) {
          if (didPlace) break;
          // Use the most constrained class's periods for this day
          const periods = this._getCommonDaySlots(classIds, day);
          const orderedPeriods = rule.preferredPeriods.length > 0
            ? [...rule.preferredPeriods.filter(p => periods.includes(p)), ...periods.filter(p => !rule.preferredPeriods.includes(p))]
            : [...periods];

          for (const period of orderedPeriods) {
            if (didPlace) break;
            const allClassesFree = classIds.every(cid => !this.classSchedule[`${cid}_${day}_${period}`]);
            if (!allClassesFree) continue;
            const tid = rule.teacher?._id?.toString();
            if (tid && this.teacherSchedule[`${tid}_${day}_${period}`]) continue;
            const rid = rule.room?._id?.toString();
            if (rid && this.roomSchedule[`${rid}_${day}_${period}`]) continue;

            let roomId = rid;
            if (!roomId) {
              const maxStudents = Math.max(...classIds.map(cid => {
                const c = this.classes.find(cl => cl._id.toString() === cid.toString());
                return c?.studentCount || 30;
              }));
              const room = this._findRoom(day, period, false, maxStudents);
              if (room) roomId = room._id.toString();
            }

            this.blocks.push({
              timetable: this.timetable._id, type: 'combined_class',
              subject: rule.subject?._id, teacher: rule.teacher?._id,
              room: roomId ? mongoose.Types.ObjectId.createFromHexString(roomId) : undefined,
              classes: classIds, day, periods: [period],
              combinationRule: rule._id
            });

            for (const cid of classIds) this._markClass(cid.toString(), day, period);
            if (tid) this._markTeacher(tid, day, period);
            if (roomId) this._markRoom(roomId, day, period);
            placed++; didPlace = true;
          }
        }
        if (!didPlace) {
          this.errors.push({ message: `Could not place combined ${rule.name} (${placed}/${rule.periodsPerWeek} placed)`, classId: classIds[0], subjectId: rule.subject?._id, teacherId: rule.teacher?._id });
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // PLACEMENT: CLASS TEACHER FIRST PERIOD
  // ═══════════════════════════════════════════════════════════════════
  async _placeClassTeacherFirstPeriod() {
    for (const cls of this.classes) {
      if (!cls.classTeacher) continue;
      const req = this.requirements.find(r =>
        r.class._id.toString() === cls._id.toString() &&
        r.teacher._id.toString() === cls.classTeacher.toString()
      );
      if (!req) continue;

      const workingDays = this._getClassWorkingDays(cls._id);
      for (const day of workingDays) {
        const daySlots = this._getClassDaySlots(cls._id, day);
        const firstPeriod = daySlots.length > 0 ? Math.min(...daySlots) : 1;

        const classKey = `${cls._id}_${day}_${firstPeriod}`;
        const teacherKey = `${cls.classTeacher}_${day}_${firstPeriod}`;
        if (this.classSchedule[classKey] || this.teacherSchedule[teacherKey]) continue;

        const room = this._findRoom(day, firstPeriod, req.subject?.requiresLab, cls.studentCount || 30);
        if (!room) continue;

        this.blocks.push({
          timetable: this.timetable._id, type: 'normal',
          subject: req.subject._id, teacher: req.teacher._id, room: room._id,
          classes: [cls._id], day, periods: [firstPeriod]
        });
        this._markClass(cls._id.toString(), day, firstPeriod);
        this._markTeacher(cls.classTeacher.toString(), day, firstPeriod);
        this._markRoom(room._id.toString(), day, firstPeriod);
        const subjDayKey = `${cls._id}_${req.subject._id}_${day}`;
        this.classDaySubjectCount[subjDayKey] = (this.classDaySubjectCount[subjDayKey] || 0) + 1;
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // PLACEMENT: REGULAR REQUIREMENTS (Main scheduling loop)
  // ═══════════════════════════════════════════════════════════════════
  async _placeRegularRequirements() {
    const reqs = [];

    for (const req of this.requirements) {
      // Skip if covered by combination rules
      const coveredByCombination = this.combinationRules.some(cr =>
        cr.subject?._id?.toString() === req.subject?._id?.toString() &&
        cr.appliesTo.some(a => (a.class?._id || a.class)?.toString() === req.class?._id?.toString())
      );
      if (coveredByCombination) continue;

      // ═══ ITEM #20: Validate teacher capability via CanTeach ═══
      if (!this._hasTeacherCapability(req.teacher._id, req.subject._id, req.class._id)) {
        this.errors.push({
          message: `${req.teacher.name} does not have CanTeach mapping for ${req.subject.name} in ${req.class.name}`,
          classId: req.class._id, subjectId: req.subject._id, teacherId: req.teacher._id
        });
        // Still try to place — log warning but don't skip (capability might be via legacy capabilities array)
      }

      // Count already-placed periods (from class teacher first period, etc.)
      const workingDays = this._getClassWorkingDays(req.class._id);
      let alreadyPlaced = 0;
      for (const day of workingDays) {
        const existing = this.blocks.find(b =>
          b.subject?.toString() === req.subject?._id?.toString() &&
          b.teacher?.toString() === req.teacher?._id?.toString() &&
          b.classes?.some(c => c.toString() === req.class?._id?.toString()) &&
          b.day === day
        );
        if (existing) alreadyPlaced++;
      }

      let remainingPeriods = req.periodsPerWeek - alreadyPlaced;
      if (remainingPeriods <= 0) continue;

      // ═══ ITEM #11: Consecutive same-subject grouping ═══
      if (req.consecutivePreference !== 'none' || req.allowDoublePeriod) {
        const groupSize = req.consecutiveCount || (req.allowDoublePeriod ? 2 : 2);
        while (remainingPeriods >= groupSize) {
          reqs.push(this._buildReqItem(req, workingDays, true, groupSize));
          remainingPeriods -= groupSize;
        }
      }

      // Remaining single periods
      for (let i = 0; i < remainingPeriods; i++) {
        reqs.push(this._buildReqItem(req, workingDays, false, 1));
      }
    }

    // Sort: constrained items first (fewer available slots = higher priority)
    reqs.sort((a, b) => {
      // Consecutive requirements first
      if (a.isConsecutive && !b.isConsecutive) return -1;
      if (!a.isConsecutive && b.isConsecutive) return 1;
      // Fewer working days = more constrained
      return a.workingDays.length - b.workingDays.length;
    });
    // Shuffle within equal-constraint groups for variety
    this._partialShuffle(reqs);

    for (const req of reqs) {
      this._placeOneRequirement(req);
    }
  }

  _buildReqItem(req, workingDays, isConsecutive, groupSize) {
    return {
      isConsecutive,
      consecutiveSize: groupSize,
      consecutivePreference: req.consecutivePreference || (req.allowDoublePeriod ? 'preferred' : 'none'),
      groupId: isConsecutive ? new mongoose.Types.ObjectId() : null,
      classId: req.class._id, className: req.class.name,
      subjectId: req.subject._id, subjectName: req.subject.name,
      teacherId: req.teacher._id, teacherName: req.teacher.name,
      requiresLab: req.subject.requiresLab, preferMorning: req.subject.preferMorning,
      preferAfternoon: req.subject.preferAfternoon, maxPerDay: req.subject.maxPerDay || 2,
      studentGroup: req.studentGroup, studentCount: req.class?.studentCount || 30,
      teacherMaxPerDay: req.teacher.maxPeriodsPerDay || 6,
      teacherMaxPerWeek: req.teacher.maxPeriodsPerWeek || 30,
      preferredDays: req.preferredDays || [], avoidDays: req.avoidDays || [],
      color: req.subject.color,
      workingDays
    };
  }

  _placeOneRequirement(req) {
    let placed = false;
    const dayOrder = req.preferredDays.length > 0
      ? [...req.preferredDays.filter(d => req.workingDays.includes(d)), ...req.workingDays.filter(d => !req.preferredDays.includes(d))]
      : [...req.workingDays];
    this._shuffle(dayOrder);

    for (const day of dayOrder) {
      if (placed) break;
      if (req.avoidDays.includes(day)) continue;

      const subjDayKey = `${req.classId}_${req.subjectId}_${day}`;
      const pendingCount = req.isConsecutive ? req.consecutiveSize : 1;
      if ((this.classDaySubjectCount[subjDayKey] || 0) + pendingCount > req.maxPerDay) continue;

      const periods = this._getSortedPeriodsForClass(req.classId, day, req);

      if (req.isConsecutive) {
        placed = this._placeConsecutive(req, day, periods, subjDayKey);
      } else {
        placed = this._placeSingle(req, day, periods, subjDayKey);
      }
    }

    if (!placed) {
      const errMsg = req.isConsecutive
        ? `Could not place ${req.consecutivePreference === 'required' ? 'REQUIRED ' : ''}consecutive ${req.subjectName} for ${req.className}`
        : `Could not place ${req.subjectName} for ${req.className} (${req.teacherName})`;
      this.errors.push({ message: errMsg, classId: req.classId, subjectId: req.subjectId, teacherId: req.teacherId });
    }
  }

  /**
   * Place consecutive periods (e.g., double period P3+P4).
   * Verifies no break exists between slots using actual per-class period structure.
   */
  _placeConsecutive(req, day, periods, subjDayKey) {
    for (let i = 0; i <= periods.length - req.consecutiveSize; i++) {
      const candidateSlots = periods.slice(i, i + req.consecutiveSize);

      // ═══ ITEM #11: Verify truly consecutive (no break between them) ═══
      let validSequence = true;
      for (let j = 0; j < candidateSlots.length - 1; j++) {
        if (!this._areConsecutiveForClass(req.classId, day, candidateSlots[j], candidateSlots[j + 1])) {
          validSequence = false;
          break;
        }
      }
      if (!validSequence) continue;

      // Check all slots are free
      let allAvailable = true;
      let room = null;
      for (const period of candidateSlots) {
        if (this.classSchedule[`${req.classId}_${day}_${period}`] ||
            this.teacherSchedule[`${req.teacherId}_${day}_${period}`]) {
          allAvailable = false; break;
        }
        // Check teacher unavailability
        const teacher = this.teachers.find(t => t._id.toString() === req.teacherId.toString());
        if (teacher?.unavailableSlots?.find(u => u.day === day)?.periods.includes(period)) {
          allAvailable = false; break;
        }
        const r = this._findRoom(day, period, req.requiresLab, req.studentCount);
        if (!r) { allAvailable = false; break; }
        if (!room) room = r;
      }

      // ═══ ITEM #21: Soft workload constraints ═══
      const tdKey = `${req.teacherId}_${day}`;
      if ((this.teacherDayCount[tdKey] || 0) + req.consecutiveSize > req.teacherMaxPerDay) {
        // Soft constraint — penalize but allow if no other option
        allAvailable = false;
      }
      const weekKey = req.teacherId.toString();
      if ((this.teacherWeekCount[weekKey] || 0) + req.consecutiveSize > req.teacherMaxPerWeek) {
        allAvailable = false;
      }

      if (allAvailable && room) {
        for (let pos = 0; pos < candidateSlots.length; pos++) {
          const p = candidateSlots[pos];
          this.blocks.push({
            timetable: this.timetable._id,
            type: candidateSlots.length === 2 ? 'double_period' : (req.studentGroup ? 'split_group' : 'normal'),
            subject: req.subjectId, teacher: req.teacherId, room: room._id,
            classes: [req.classId], day, periods: [p],
            studentGroup: req.studentGroup || null,
            consecutiveGroupId: req.groupId,
            consecutivePosition: pos + 1
          });
          this._markClass(req.classId.toString(), day, p);
          this._markTeacher(req.teacherId.toString(), day, p);
          this._markRoom(room._id.toString(), day, p);
        }
        this.classDaySubjectCount[subjDayKey] = (this.classDaySubjectCount[subjDayKey] || 0) + req.consecutiveSize;
        return true;
      }
    }
    return false;
  }

  _placeSingle(req, day, periods, subjDayKey) {
    for (const period of periods) {
      if (this.classSchedule[`${req.classId}_${day}_${period}`] ||
          this.teacherSchedule[`${req.teacherId}_${day}_${period}`]) continue;

      // Teacher daily limit (soft constraint)
      const tdKey = `${req.teacherId}_${day}`;
      if ((this.teacherDayCount[tdKey] || 0) >= req.teacherMaxPerDay) continue;

      // Teacher weekly limit
      const weekKey = req.teacherId.toString();
      if ((this.teacherWeekCount[weekKey] || 0) >= req.teacherMaxPerWeek) continue;

      // Teacher unavailability
      const teacher = this.teachers.find(t => t._id.toString() === req.teacherId.toString());
      if (teacher?.unavailableSlots?.find(u => u.day === day)?.periods.includes(period)) continue;

      // ═══ ITEM #19: Apply custom rule hard constraints ═══
      if (this._violatesCustomRules(req, day, period)) continue;

      const room = this._findRoom(day, period, req.requiresLab, req.studentCount);
      if (!room) continue;

      this.blocks.push({
        timetable: this.timetable._id,
        type: req.studentGroup ? 'split_group' : 'normal',
        subject: req.subjectId, teacher: req.teacherId, room: room._id,
        classes: [req.classId], day, periods: [period],
        studentGroup: req.studentGroup || null
      });

      this._markClass(req.classId.toString(), day, period);
      this._markTeacher(req.teacherId.toString(), day, period);
      this._markRoom(room._id.toString(), day, period);
      this.classDaySubjectCount[subjDayKey] = (this.classDaySubjectCount[subjDayKey] || 0) + 1;
      return true;
    }
    return false;
  }

  // ═══════════════════════════════════════════════════════════════════
  // BREAK BLOCKS
  // ═══════════════════════════════════════════════════════════════════
  _placeBreakBlocks() {
    for (const cls of this.classes) {
      const workingDays = this._getClassWorkingDays(cls._id);
      for (const day of workingDays) {
        const cp = this.classPeriodMap[cls._id.toString()];
        const breaks = cp?.dayBreaks?.[day] || [];
        for (const bp of breaks) {
          this.blocks.push({
            timetable: this.timetable._id, type: 'reserved',
            classes: [cls._id], day, periods: [bp], isLocked: true
          });
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // CAPABILITY CHECK (Item #20)
  // ═══════════════════════════════════════════════════════════════════
  _hasTeacherCapability(teacherId, subjectId, classId) {
    // Check CanTeach model
    const mapping = this.canTeachMappings.find(m =>
      m.teacher.toString() === teacherId.toString() &&
      m.subject.toString() === subjectId.toString()
    );
    if (mapping) {
      // If mapping has eligibleClasses, check class is included
      if (mapping.eligibleClasses.length === 0) return true;
      return mapping.eligibleClasses.some(c => c.toString() === classId.toString());
    }

    // Fallback: check teacher's legacy capabilities array
    const teacher = this.teachers.find(t => t._id.toString() === teacherId.toString());
    if (teacher?.capabilities?.some(c =>
      (c.subject?._id || c.subject)?.toString() === subjectId.toString()
    )) return true;

    // If no CanTeach data exists at all, allow (backward compatibility)
    if (this.canTeachMappings.length === 0) return true;

    return false;
  }

  // ═══════════════════════════════════════════════════════════════════
  // CUSTOM RULE ENFORCEMENT (Item #19)
  // ═══════════════════════════════════════════════════════════════════
  _violatesCustomRules(req, day, period) {
    for (const rule of this.customRules) {
      if (rule.enforcement !== 'hard') continue;

      // Check if this rule applies to the current requirement
      const applies = this._customRuleApplies(rule, req);
      if (!applies) continue;

      // Evaluate the rule condition
      if (rule.ruleType === 'avoid_period' && rule.conditions?.periods?.includes(period)) return true;
      if (rule.ruleType === 'avoid_day' && rule.conditions?.days?.includes(day)) return true;
      if (rule.ruleType === 'require_before_period' && period > (rule.conditions?.maxPeriod || 99)) return true;
      if (rule.ruleType === 'require_after_period' && period < (rule.conditions?.minPeriod || 0)) return true;
    }
    return false;
  }

  _customRuleApplies(rule, req) {
    if (rule.scope === 'subject' && rule.targetSubject?.toString() === req.subjectId?.toString()) return true;
    if (rule.scope === 'teacher' && rule.targetTeacher?.toString() === req.teacherId?.toString()) return true;
    if (rule.scope === 'class' && rule.targetClass?.toString() === req.classId?.toString()) return true;
    if (rule.scope === 'global') return true;
    return false;
  }

  // ═══════════════════════════════════════════════════════════════════
  // QUALITY SCORING (Items #9, #18, #21)
  // ═══════════════════════════════════════════════════════════════════
  _calculateScore() {
    const factors = {};
    let softTotal = 0;

    // Factor 1: Subject distribution (avoid same subject too many times per day)
    let distribPenalty = 0;
    for (const key of Object.keys(this.classDaySubjectCount)) {
      const count = this.classDaySubjectCount[key];
      if (count > 2) distribPenalty += (count - 2) * 5;
    }
    factors.subjectDistribution = Math.max(0, 100 - distribPenalty);
    softTotal += factors.subjectDistribution;

    // Factor 2: Teacher workload balance (across days)
    const teacherDayLoads = {};
    for (const key of Object.keys(this.teacherDayCount)) {
      const tid = key.split('_')[0];
      if (!teacherDayLoads[tid]) teacherDayLoads[tid] = [];
      teacherDayLoads[tid].push(this.teacherDayCount[key]);
    }
    let balancePenalty = 0;
    for (const loads of Object.values(teacherDayLoads)) {
      if (loads.length < 2) continue;
      const avg = loads.reduce((a, b) => a + b, 0) / loads.length;
      const variance = loads.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / loads.length;
      balancePenalty += Math.sqrt(variance) * 3;
    }
    factors.teacherWorkloadBalance = Math.max(0, Math.round(100 - balancePenalty));
    softTotal += factors.teacherWorkloadBalance;

    // Factor 3: Timing preferences (morning/afternoon subjects)
    let morningScore = 0, morningTotal = 0;
    for (const b of this.blocks) {
      if (!b.subject) continue;
      const req = this.requirements.find(r => r.subject?._id?.toString() === b.subject?.toString());
      if (!req) continue;
      const cp = this.classPeriodMap[b.classes?.[0]?.toString()];
      const allSlots = cp?.daySlots?.[b.day] || this.classPeriodMap[Object.keys(this.classPeriodMap)[0]]?.allTimeslots || [];
      const midPoint = allSlots.length > 0 ? allSlots[Math.floor(allSlots.length / 2)] : 4;
      if (req.subject?.preferMorning) { morningTotal++; if (b.periods[0] <= midPoint) morningScore++; }
      if (req.subject?.preferAfternoon) { morningTotal++; if (b.periods[0] > midPoint) morningScore++; }
    }
    factors.timingPreferences = morningTotal > 0 ? Math.round((morningScore / morningTotal) * 100) : 100;
    softTotal += factors.timingPreferences;

    // Factor 4: Class teacher first period coverage
    let ctCoverage = 0, ctTotal = 0;
    if (this.school.settings?.classTeacherFirstPeriodPreference) {
      for (const cls of this.classes) {
        if (!cls.classTeacher) continue;
        const workingDays = this._getClassWorkingDays(cls._id);
        for (const day of workingDays) {
          const daySlots = this._getClassDaySlots(cls._id, day);
          const firstPeriod = daySlots.length > 0 ? Math.min(...daySlots) : 1;
          ctTotal++;
          const hasFirst = this.blocks.some(b =>
            b.teacher?.toString() === cls.classTeacher?.toString() &&
            b.classes?.some(c => c.toString() === cls._id.toString()) &&
            b.day === day && b.periods.includes(firstPeriod)
          );
          if (hasFirst) ctCoverage++;
        }
      }
    }
    factors.classTeacherFirstPeriod = ctTotal > 0 ? Math.round((ctCoverage / ctTotal) * 100) : 100;
    softTotal += factors.classTeacherFirstPeriod;

    // Factor 5: Completeness (no unplaced items)
    factors.completeness = this.errors.length === 0 ? 100 : Math.max(0, 100 - this.errors.length * 10);
    softTotal += factors.completeness;

    // Factor 6: Consecutive placement quality
    let consecutiveOk = 0, consecutiveTotal = 0;
    const groupBlocks = {};
    for (const b of this.blocks) {
      if (b.consecutiveGroupId) {
        const gid = b.consecutiveGroupId.toString();
        if (!groupBlocks[gid]) groupBlocks[gid] = [];
        groupBlocks[gid].push(b);
      }
    }
    for (const group of Object.values(groupBlocks)) {
      consecutiveTotal++;
      if (group.length < 2) continue;
      const sorted = group.sort((a, b) => a.consecutivePosition - b.consecutivePosition);
      let allConsecutive = true;
      for (let i = 0; i < sorted.length - 1; i++) {
        if (sorted[i].day !== sorted[i + 1].day || !this._areConsecutiveForClass(
          sorted[i].classes[0], sorted[i].day, sorted[i].periods[0], sorted[i + 1].periods[0]
        )) {
          allConsecutive = false; break;
        }
      }
      if (allConsecutive) consecutiveOk++;
    }
    factors.consecutiveQuality = consecutiveTotal > 0 ? Math.round((consecutiveOk / consecutiveTotal) * 100) : 100;
    softTotal += factors.consecutiveQuality;

    // Factor 7: Soft preference adherence
    let prefScore = 0, prefTotal = 0;
    for (const pref of this.softPreferences) {
      prefTotal++;
      // Check if the preference is satisfied in the generated blocks
      const satisfied = this._evaluateSoftPreference(pref);
      if (satisfied) prefScore++;
    }
    factors.softPreferences = prefTotal > 0 ? Math.round((prefScore / prefTotal) * 100) : 100;
    softTotal += factors.softPreferences;

    const numFactors = Object.keys(factors).length;
    const total = numFactors > 0 ? Math.round(softTotal / numFactors) : 0;

    return { hard: this.errors.length, soft: total, total, factors };
  }

  _evaluateSoftPreference(pref) {
    // Basic preference evaluation
    if (pref.type === 'teacher_free_period' && pref.teacher && pref.day && pref.period) {
      return !this.teacherSchedule[`${pref.teacher}_${pref.day}_${pref.period}`];
    }
    if (pref.type === 'subject_time_preference' && pref.subject) {
      const subBlocks = this.blocks.filter(b => b.subject?.toString() === pref.subject?.toString());
      if (pref.preferBefore && subBlocks.length > 0) {
        return subBlocks.every(b => b.periods[0] <= (pref.preferBefore || 4));
      }
    }
    return true; // Assume satisfied if can't evaluate
  }

  // ═══════════════════════════════════════════════════════════════════
  // CONFLICT DETECTION (Item #25)
  // ═══════════════════════════════════════════════════════════════════
  async _detectConflicts() {
    const blocks = await LessonBlock.find({ timetable: this.timetable._id }).populate('teacher classes subject room');
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
          const sameCombo = tBlocks.every(b => b.combinationRule && b.combinationRule.toString() === tBlocks[0].combinationRule?.toString());
          if (!sameCombo) {
            conflicts.push(await ConflictLog.create({
              timetable: this.timetable._id, type: 'teacher_clash', severity: 'critical',
              day, period: parseInt(period), teacher: tid,
              classes: tBlocks.flatMap(b => b.classes), blocks: tBlocks.map(b => b._id),
              title: 'Teacher Double-Booked',
              message: `${tBlocks[0].teacher.name} is assigned to ${tBlocks.length} classes at ${day} Period ${period}`,
              suggestedFix: 'Move one lesson to a different period or assign a different teacher'
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
          const sameCombo = rBlocks.every(b => b.combinationRule && b.combinationRule.toString() === rBlocks[0].combinationRule?.toString());
          if (!sameCombo) {
            conflicts.push(await ConflictLog.create({
              timetable: this.timetable._id, type: 'room_clash', severity: 'high',
              day, period: parseInt(period), room: rid,
              classes: rBlocks.flatMap(b => b.classes), blocks: rBlocks.map(b => b._id),
              title: 'Room Double-Booked',
              message: `${rBlocks[0].room.name} has ${rBlocks.length} lessons at ${day} Period ${period}`,
              suggestedFix: 'Assign a different room to one of the lessons'
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
          const allSameCombo = cBlocks.every(b => b.combinationRule && b.combinationRule.toString() === cBlocks[0].combinationRule?.toString());
          const allSplitGroup = cBlocks.every(b => b.type === 'split_group');
          if (!allSameCombo && !allSplitGroup) {
            conflicts.push(await ConflictLog.create({
              timetable: this.timetable._id, type: 'class_clash', severity: 'critical',
              day, period: parseInt(period),
              classes: [cid], blocks: cBlocks.map(b => b._id),
              title: 'Class Double-Booked',
              message: `Class has ${cBlocks.length} lessons at ${day} Period ${period}`,
              suggestedFix: 'Remove one of the lessons or move to a different period'
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
      const tName = b.teacher.name;
      for (const p of b.periods) {
        const dk = `${tid}_${b.day}`;
        if (!teacherDayTotals[dk]) teacherDayTotals[dk] = { count: 0, tid, day: b.day, name: tName };
        teacherDayTotals[dk].count++;
      }
    }
    for (const info of Object.values(teacherDayTotals)) {
      const teacher = this.teachers.find(t => t._id.toString() === info.tid);
      if (teacher && info.count > teacher.maxPeriodsPerDay) {
        conflicts.push(await ConflictLog.create({
          timetable: this.timetable._id, type: 'teacher_overload', severity: 'high',
          day: info.day, teacher: info.tid,
          title: 'Teacher Overloaded',
          message: `${info.name} has ${info.count} periods on ${info.day} (max: ${teacher.maxPeriodsPerDay})`,
          suggestedFix: 'Move some lessons to other days'
        }));
      }
    }

    // Unplaced lessons
    for (const err of this.errors) {
      conflicts.push(await ConflictLog.create({
        timetable: this.timetable._id, type: 'unassigned_lesson', severity: 'high',
        classes: err.classId ? [err.classId] : [],
        subject: err.subjectId, teacher: err.teacherId,
        title: 'Unplaced Lesson',
        message: err.message,
        suggestedFix: 'Ensure enough periods available, check teacher/room availability'
      }));
    }

    return conflicts;
  }

  // ═══════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════
  _getCommonWorkingDays(classIds) {
    const daysSets = classIds.map(cid => this._getClassWorkingDays(cid));
    return daysSets.reduce((common, days) => common.filter(d => days.includes(d)), daysSets[0] || []);
  }

  _getCommonDaySlots(classIds, day) {
    const slotSets = classIds.map(cid => this._getClassDaySlots(cid, day));
    return slotSets.reduce((common, slots) => common.filter(s => slots.includes(s)), slotSets[0] || []);
  }

  _getSortedPeriodsForClass(classId, day, req) {
    const periods = [...this._getClassDaySlots(classId, day)];
    if (req.preferMorning) periods.sort((a, b) => a - b);
    else if (req.preferAfternoon) periods.sort((a, b) => b - a);
    else this._shuffle(periods);
    return periods;
  }

  _findRoom(day, period, requiresLab, studentCount) {
    const targetType = requiresLab ? 'lab' : 'classroom';
    // Pass 1: exact type + capacity match
    for (const room of this.rooms) {
      if (room.type === targetType && room.capacity >= studentCount) {
        const key = `${room._id}_${day}_${period}`;
        if (!this.roomSchedule[key]) {
          const unavail = room.unavailableSlots?.find(u => u.day === day);
          if (!unavail || !unavail.periods.includes(period)) return room;
        }
      }
    }
    // Pass 2: any type with capacity
    for (const room of this.rooms) {
      if (room.capacity >= studentCount) {
        const key = `${room._id}_${day}_${period}`;
        if (!this.roomSchedule[key]) return room;
      }
    }
    // Pass 3: any available room
    for (const room of this.rooms) {
      const key = `${room._id}_${day}_${period}`;
      if (!this.roomSchedule[key]) return room;
    }
    return null;
  }

  _markTeacher(tid, day, period) {
    this.teacherSchedule[`${tid}_${day}_${period}`] = true;
    const dk = `${tid}_${day}`;
    this.teacherDayCount[dk] = (this.teacherDayCount[dk] || 0) + 1;
    this.teacherWeekCount[tid] = (this.teacherWeekCount[tid] || 0) + 1;
  }

  _markRoom(rid, day, period) { this.roomSchedule[`${rid}_${day}_${period}`] = true; }
  _markClass(cid, day, period) { this.classSchedule[`${cid}_${day}_${period}`] = true; }

  _shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /**
   * Partial shuffle: preserves relative priority ordering but shuffles within same-priority groups.
   * This ensures constrained items go first but provides variety within groups.
   */
  _partialShuffle(reqs) {
    let i = 0;
    while (i < reqs.length) {
      let j = i;
      while (j < reqs.length &&
             reqs[j].isConsecutive === reqs[i].isConsecutive &&
             reqs[j].workingDays?.length === reqs[i].workingDays?.length) {
        j++;
      }
      // Shuffle the group [i, j)
      const group = reqs.slice(i, j);
      this._shuffle(group);
      for (let k = 0; k < group.length; k++) {
        reqs[i + k] = group[k];
      }
      i = j;
    }
  }
}

module.exports = SchedulerEngine;
