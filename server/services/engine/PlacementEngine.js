const mongoose = require('mongoose');

/**
 * Failure code enum for structured diagnostics.
 */
const FAILURE_CODES = {
  NO_SLOT_AVAILABLE: 'NO_SLOT_AVAILABLE',
  NO_CONTINUOUS_SLOT: 'NO_CONTINUOUS_SLOT',
  TEACHER_OVERLOADED: 'TEACHER_OVERLOADED',
  NO_ROOM_AVAILABLE: 'NO_ROOM_AVAILABLE',
  BREAK_CONFLICT: 'BREAK_CONFLICT',
  COMBINED_ATOMIC_FAIL: 'COMBINED_ATOMIC_FAIL',
  SPLIT_GROUP_FAIL: 'SPLIT_GROUP_FAIL',
  TEACHER_CONTINUOUS_EXCEEDED: 'TEACHER_CONTINUOUS_EXCEEDED',
  ACTIVITY_NO_SLOT: 'ACTIVITY_NO_SLOT'
};

// Room type compatibility groups — compatible types that can substitute
const ROOM_COMPAT = {
  lab: ['lab', 'computer_lab'],
  computer_lab: ['computer_lab', 'lab'],
  art_room: ['art_room', 'music_room', 'classroom'],
  music_room: ['music_room', 'art_room', 'classroom'],
  library: ['library'],
  playground: ['playground'],
  auditorium: ['auditorium'],
  classroom: ['classroom'],
  other: ['other', 'classroom']
};

/**
 * PlacementEngine — Stage 4 of the scheduling pipeline.
 *
 * Assigns blocks into valid timeslots using the ConstraintValidator.
 * Placement order:
 *   1. Reserved rules (assembly, prayer, activities)
 *   2. Combined class blocks (atomic placement)
 *   3. Split group pairs (parallel placement)
 *   4. Class teacher first period
 *   5. Consecutive/double period blocks (atomic multi-period)
 *   6. Single period blocks (scoring-guided)
 */
class PlacementEngine {
  /**
   * @param {Object} options
   * @param {Object} options.validator       - ConstraintValidator instance
   * @param {Object} options.classPeriodMap  - Per-class period structures
   * @param {Array}  options.rooms           - Room documents
   * @param {Array}  options.classes         - Class documents
   * @param {Array}  options.teachers        - Teacher documents
   * @param {Object} options.school          - School document
   * @param {Object} options.rng             - SeededRandom instance
   * @param {Function} options.onProgress    - Progress callback(stage, percent)
   */
  constructor(options) {
    this.validator = options.validator;
    this.classPeriodMap = options.classPeriodMap;
    this.rooms = options.rooms;
    this.classes = options.classes;
    this.teachers = options.teachers;
    this.school = options.school;
    this.rng = options.rng;
    this.onProgress = options.onProgress || (() => {});
    this.generationOptions = options.generationOptions || {};

    // Shared scheduling state (same object references as validator context)
    this.ctx = this.validator.ctx;

    // ── Performance: O(1) teacher lookup map (replaces O(n) find calls) ──
    this.teacherMap = new Map();
    for (const t of this.teachers) {
      this.teacherMap.set(t._id.toString(), t);
    }

    // ── Enhanced room bucketing: all 9 room types from Room model ──
    this.roomsByType = {};
    for (const r of [...this.rooms].sort((a, b) => a.capacity - b.capacity)) {
      const t = r.type || 'classroom';
      if (!this.roomsByType[t]) this.roomsByType[t] = [];
      this.roomsByType[t].push(r);
    }
    this.allRoomsSorted = [...this.rooms].sort((a, b) => a.capacity - b.capacity);

    // ── Subject-day spread tracking (Component 5) ──
    // Tracks which days each subject is placed for each class: { "cid_sid": Set<day> }
    this._subjectDaySpread = {};
    // Track first/last period assignments: { "cid_firstOrLast": { subjectId: count } }
    this._periodEdgeTracker = {};

    // Output
    this.placedBlocks = [];
    this.errors = [];
    this._backtrackAttempts = 0;
    this._maxBacktrack = 3;
  }

  /**
   * Run full placement pipeline.
   * @param {Object} params
   * @param {Array} params.reservedRules      - ReservedPeriodRule documents
   * @param {Array} params.combinedBlocks     - Combined block descriptors
   * @param {Array} params.splitPairs         - Split group pair descriptors
   * @param {Array} params.regularBlocks      - Regular block descriptors
   * @param {mongoose.Types.ObjectId} params.timetableId
   * @returns {{ placedBlocks: Array, errors: Array }}
   */
  place(params) {
    const { reservedRules, combinedBlocks, splitPairs, regularBlocks, timetableId, lockedBlocks } = params;
    this.timetableId = timetableId;

    // Stage 4-pre: Load locked blocks from previous timetable
    if (lockedBlocks && lockedBlocks.length > 0) {
      this.onProgress('locked_blocks', 0);
      this._preloadLockedBlocks(lockedBlocks);
    }

    // Stage 4a: Reserved rules
    this.onProgress('reserved', 0);
    this._placeReservedRules(reservedRules);

    // Stage 4b: Combined class blocks
    this.onProgress('combined', 20);
    this._placeCombinedBlocks(combinedBlocks);

    // Stage 4c: Split group pairs
    this.onProgress('split_groups', 35);
    this._placeSplitPairs(splitPairs);

    // Stage 4d: Class teacher first period
    this.onProgress('class_teacher', 45);
    this._placeClassTeacherFirstPeriod(regularBlocks);

    // Stage 4e: Regular requirements (consecutive first, then singles)
    this.onProgress('regular', 50);
    this._placeRegularBlocks(regularBlocks);

    // Stage 4f: Relaxed retry sweep for failed blocks
    this.onProgress('retry', 88);
    this._retryFailedBlocks(regularBlocks);

    // Stage 4g: Break blocks for visualization
    this.onProgress('breaks', 95);
    this._placeBreakBlocks();

    this.onProgress('complete', 100);
    return { placedBlocks: this.placedBlocks, errors: this.errors };
  }

  // ═══════════════════════════════════════════════════════════════════
  // RESERVED RULES
  // ═══════════════════════════════════════════════════════════════════
  _placeReservedRules(reservedRules) {
    for (const rule of reservedRules) {
      const targetClasses = rule.appliesTo?.length > 0
        ? rule.appliesTo.map(a => a.class?._id || a.class).filter(Boolean)
        : this.classes.map(c => c._id);

      const block = {
        timetable: this.timetableId,
        type: 'reserved',
        subject: rule.subject?._id,
        teacher: rule.teacher?._id,
        room: rule.room?._id,
        classes: targetClasses,
        day: rule.day,
        periods: rule.periods,
        duration: rule.periods.length,
        isLocked: rule.isLocked !== false
      };
      this.placedBlocks.push(block);

      for (const p of rule.periods) {
        for (const cid of targetClasses) this._markClass(cid.toString(), rule.day, p, null);
        if (rule.teacher) this._markTeacher(rule.teacher._id.toString(), rule.day, p);
        if (rule.room) this._markRoom(rule.room._id.toString(), rule.day, p);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // LOCKED BLOCK PRE-LOADING (Priority 3)
  // ═══════════════════════════════════════════════════════════════════
  _preloadLockedBlocks(lockedBlocks) {
    for (const lb of lockedBlocks) {
      // Add to placed list (with new timetable ID)
      const block = {
        timetable: this.timetableId,
        type: lb.type || 'normal',
        subject: lb.subject,
        teacher: lb.teacher,
        room: lb.room,
        classes: lb.classes || [],
        day: lb.day,
        periods: lb.periods || [],
        duration: lb.duration || lb.periods?.length || 1,
        isLocked: true,
        studentGroup: lb.studentGroup || null,
        combinedContext: lb.combinedContext || null,
        groupContext: lb.groupContext || null
      };
      this.placedBlocks.push(block);

      // Mark all resources as occupied
      for (const p of block.periods) {
        for (const cid of block.classes) {
          this._markClass(cid.toString(), block.day, p, block.studentGroup);
        }
        if (block.teacher) this._markTeacher(block.teacher.toString(), block.day, p);
        if (block.room) this._markRoom(block.room.toString(), block.day, p);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // COMBINED BLOCKS (Atomic placement — all classes or fail)
  // ═══════════════════════════════════════════════════════════════════
  _placeCombinedBlocks(combinedBlocks) {
    for (const cb of combinedBlocks) {
      const classIds = cb.classIds.map(c => c.toString());

      // Find common working days across all classes
      const commonDays = this._getCommonWorkingDays(classIds);
      const daysOrder = cb.preferredDays.length > 0
        ? [...cb.preferredDays.filter(d => commonDays.includes(d)), ...commonDays.filter(d => !cb.preferredDays.includes(d))]
        : [...commonDays];
      this.rng.shuffle(daysOrder);

      let placed = false;
      for (const day of daysOrder) {
        if (placed) break;

        const periods = this._getCommonDaySlots(classIds, day);
        const orderedPeriods = cb.preferredPeriods.length > 0
          ? [...cb.preferredPeriods.filter(p => periods.includes(p)), ...periods.filter(p => !cb.preferredPeriods.includes(p))]
          : [...periods];

        for (const period of orderedPeriods) {
          if (placed) break;

          // Validate ALL classes are free (atomic check)
          const allFree = classIds.every(cid => !this.ctx.classSchedule[`${cid}_${day}_${period}`]);
          if (!allFree) continue;

          // Teacher check
          const tid = cb.teacherId?.toString();
          if (tid && this.ctx.teacherSchedule[`${tid}_${day}_${period}`]) continue;

          // Teacher unavailability
          if (tid) {
            const teacher = this.teacherMap.get(tid);
            if (teacher?.unavailableSlots?.find(u => u.day === day)?.periods?.includes(period)) continue;
          }

          // Find room
          let roomId = cb.roomId?.toString();
          if (!roomId) {
            const room = this._findRoom(day, period, cb.requiredRoomType || (cb.requiresLab ? 'lab' : 'classroom'), cb.totalStudents);
            if (room) roomId = room._id.toString();
          } else if (this.ctx.roomSchedule[`${roomId}_${day}_${period}`]) {
            // Specified room busy — find alternative
            const room = this._findRoom(day, period, cb.requiredRoomType || (cb.requiresLab ? 'lab' : 'classroom'), cb.totalStudents);
            if (room) roomId = room._id.toString();
            else continue;
          }

          // Place the atomic combined block
          const block = {
            timetable: this.timetableId,
            type: 'combined_class',
            subject: cb.subjectId,
            teacher: cb.teacherId,
            room: roomId ? mongoose.Types.ObjectId.createFromHexString(roomId) : undefined,
            classes: classIds.map(c => {
              try { return mongoose.Types.ObjectId.createFromHexString(c); } catch { return c; }
            }),
            day,
            periods: [period],
            duration: 1,
            combinationRule: cb.combinationRuleId,
            combinedContext: {
              isCombined: true,
              primaryClass: classIds[0],
              combinationRule: cb.combinationRuleId
            },
            priorityWeight: cb.priorityWeight
          };
          this.placedBlocks.push(block);

          // Mark all resources
          for (const cid of classIds) this._markClass(cid, day, period, null);
          if (tid) this._markTeacher(tid, day, period);
          if (roomId) this._markRoom(roomId, day, period);
          placed = true;
        }
      }

      if (!placed) {
        this.errors.push({
          blockId: null,
          reason: FAILURE_CODES.COMBINED_ATOMIC_FAIL,
          message: `Could not place combined block: ${cb.subjectName} for ${classIds.length} classes`,
          details: {
            subject: { id: cb.subjectId, name: cb.subjectName },
            teacher: { id: cb.teacherId, name: cb.teacherName },
            classIds,
            requiredDuration: 1
          },
          suggestions: [
            { action: 'relax_combination', description: 'Place as separate class blocks', confidence: 70 },
            { action: 'change_teacher', description: 'Assign a different teacher with more availability', confidence: 50 }
          ],
          type: 'combined_unplaced',
          classId: classIds[0],
          subjectId: cb.subjectId,
          teacherId: cb.teacherId
        });
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // SPLIT GROUP PAIRS (Parallel placement)
  // ═══════════════════════════════════════════════════════════════════
  _placeSplitPairs(splitPairs) {
    for (const pair of splitPairs) {
      const classId = pair.classId;
      const blocks = pair.blocks;

      // Find a day+period where ALL blocks in the pair can be placed simultaneously
      const workingDays = this._getClassWorkingDays(classId);
      this.rng.shuffle([...workingDays]);

      let placed = false;
      for (const day of workingDays) {
        if (placed) break;
        const periods = this._getClassDaySlots(classId, day);

        for (const period of periods) {
          if (placed) break;

          // Check: the class slot must either be free or only occupied by other groups
          const classKey = `${classId}_${day}_${period}`;
          const existing = this.ctx.classSchedule[classKey];
          if (existing === true) continue; // Whole-class block — can't overlay

          // Check all blocks in the pair can fit
          let allValid = true;
          const roomsNeeded = [];

          for (const block of blocks) {
            const tid = block.teacherId?.toString();
            if (tid && this.ctx.teacherSchedule[`${tid}_${day}_${period}`]) {
              allValid = false;
              break;
            }
            // Teacher unavailability
            if (tid) {
              const teacher = this.teacherMap.get(tid);
              if (teacher?.unavailableSlots?.find(u => u.day === day)?.periods?.includes(period)) {
                allValid = false;
                break;
              }
            }
            const room = this._findRoom(day, period, block.requiredRoomType || (block.requiresLab ? 'lab' : 'classroom'), block.studentCount, roomsNeeded);
            if (!room) { allValid = false; break; }
            roomsNeeded.push(room._id.toString());
          }

          if (!allValid) continue;

          // Place all blocks in the pair simultaneously
          for (let i = 0; i < blocks.length; i++) {
            const block = blocks[i];
            const placedBlock = {
              timetable: this.timetableId,
              type: 'split_group',
              subject: block.subjectId,
              teacher: block.teacherId,
              room: mongoose.Types.ObjectId.createFromHexString(roomsNeeded[i]),
              classes: [typeof classId === 'string' ?
                mongoose.Types.ObjectId.createFromHexString(classId) : classId],
              day,
              periods: [period],
              duration: 1,
              studentGroup: block.studentGroup,
              groupContext: {
                groupName: block.studentGroup,
                isParallel: true
              },
              priorityWeight: pair.priorityWeight
            };
            this.placedBlocks.push(placedBlock);

            const tid = block.teacherId?.toString();
            if (tid) this._markTeacher(tid, day, period);
            this._markRoom(roomsNeeded[i], day, period);
          }

          // Mark class slot with group info (allows other groups to share)
          this.ctx.classSchedule[classKey] = `split:${blocks.map(b => b.studentGroup).join(',')}`;

          // Update subject-day counts
          for (const block of blocks) {
            const subjDayKey = `${classId}_${block.subjectId}_${day}`;
            this.ctx.classDaySubjectCount[subjDayKey] = (this.ctx.classDaySubjectCount[subjDayKey] || 0) + 1;
            this._trackSubjectSpread(classId, block.subjectId, day);
          }

          placed = true;
        }
      }

      if (!placed) {
        // Enhanced diagnostics: track per-slot failure reasons
        const failedSlots = this._diagnoseSplitPairFailure(pair);
        for (const block of blocks) {
          this.errors.push({
            blockId: null,
            reason: FAILURE_CODES.SPLIT_GROUP_FAIL,
            message: `Could not place split-group block: ${block.subjectName} (${block.studentGroup}) for class ${classId}`,
            details: {
              subject: { id: block.subjectId, name: block.subjectName },
              teacher: { id: block.teacherId, name: block.teacherName },
              class: { id: classId },
              studentGroup: block.studentGroup,
              pairSize: blocks.length,
              failedSlots
            },
            suggestions: [
              { action: 'change_teacher', description: 'Assign a teacher with more free slots', confidence: 60 },
              { action: 'add_room', description: 'Ensure enough rooms for parallel placement', confidence: 70 }
            ],
            type: 'split_group_unplaced',
            affectedClass: classId,
            affectedSubject: block.subjectName,
            affectedTeacher: block.teacherName,
            affectedRoom: block.requiredRoomType || 'classroom',
            rootCause: failedSlots.length > 0 ? failedSlots[0].reason : 'No common free slot for all parallel groups',
            confidenceScore: 55,
            classId: block.classId,
            subjectId: block.subjectId,
            teacherId: block.teacherId
          });
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // CLASS TEACHER FIRST PERIOD
  // ═══════════════════════════════════════════════════════════════════
  _placeClassTeacherFirstPeriod(regularBlocks) {
    if (!this.school.settings?.classTeacherFirstPeriodPreference) return;

    for (const cls of this.classes) {
      if (!cls.classTeacher) continue;

      // Find a regular block for this class+teacher
      const reqIdx = regularBlocks.findIndex(b =>
        b.classId?.toString() === cls._id.toString() &&
        b.teacherId?.toString() === cls.classTeacher.toString() &&
        !b._placed
      );
      if (reqIdx === -1) continue;
      const req = regularBlocks[reqIdx];

      const workingDays = this._getClassWorkingDays(cls._id);
      for (const day of workingDays) {
        const daySlots = this._getClassDaySlots(cls._id, day);
        const firstPeriod = daySlots.length > 0 ? Math.min(...daySlots) : 1;

        const classKey = `${cls._id}_${day}_${firstPeriod}`;
        const teacherKey = `${cls.classTeacher}_${day}_${firstPeriod}`;
        if (this.ctx.classSchedule[classKey] || this.ctx.teacherSchedule[teacherKey]) continue;

        const room = this._findRoom(day, firstPeriod, req.requiredRoomType || 'classroom', cls.studentCount || 30);
        if (!room) continue;

        this.placedBlocks.push({
          timetable: this.timetableId,
          type: 'normal',
          subject: req.subjectId,
          teacher: req.teacherId,
          room: room._id,
          classes: [cls._id],
          day,
          periods: [firstPeriod],
          duration: 1
        });

        this._markClass(cls._id.toString(), day, firstPeriod, null);
        this._markTeacher(cls.classTeacher.toString(), day, firstPeriod);
        this._markRoom(room._id.toString(), day, firstPeriod);
        const subjDayKey = `${cls._id}_${req.subjectId}_${day}`;
        this.ctx.classDaySubjectCount[subjDayKey] = (this.ctx.classDaySubjectCount[subjDayKey] || 0) + 1;
        this._trackSubjectSpread(cls._id.toString(), req.subjectId?.toString(), day);

        // Mark this block descriptor as placed (remove from regular queue)
        regularBlocks[reqIdx]._placed = true;
        break; // Only place one per class for first period
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // REGULAR BLOCKS (Consecutive first, then singles)
  // ═══════════════════════════════════════════════════════════════════
  _placeRegularBlocks(regularBlocks) {
    // Filter out already-placed blocks
    const remaining = regularBlocks.filter(b => !b._placed);

    // Sort: consecutive first, then by priority weight (descending), then by constraint tightness
    remaining.sort((a, b) => {
      if (a.isConsecutive && !b.isConsecutive) return -1;
      if (!a.isConsecutive && b.isConsecutive) return 1;
      if ((b.priorityWeight || 50) !== (a.priorityWeight || 50))
        return (b.priorityWeight || 50) - (a.priorityWeight || 50);
      return (a.workingDays?.length || 6) - (b.workingDays?.length || 6);
    });

    // Partial shuffle within same-priority groups for variety
    this.rng.partialShuffle(remaining, (item) =>
      `${item.isConsecutive ? 1 : 0}_${item.priorityWeight || 50}_${item.workingDays?.length || 6}`
    );

    const totalBlocks = remaining.length;
    for (let i = 0; i < remaining.length; i++) {
      if (i % 20 === 0) this.onProgress('regular', 50 + Math.round((i / totalBlocks) * 45));
      this._placeOneRegularBlock(remaining[i]);
    }
  }

  _placeOneRegularBlock(req) {
    const dayOrder = req.preferredDays?.length > 0
      ? [...req.preferredDays.filter(d => req.workingDays.includes(d)),
         ...req.workingDays.filter(d => !req.preferredDays.includes(d))]
      : [...(req.workingDays || [])];
    this.rng.shuffle(dayOrder);

    // Component 5: Subject-spread-aware day ordering
    const cid = req.classId?.toString();
    const sid = req.subjectId?.toString();
    this._sortDaysBySpread(dayOrder, cid, sid);

    for (const day of dayOrder) {
      if (req.avoidDays?.includes(day)) continue;

      const subjDayKey = `${cid}_${sid}_${day}`;
      const pendingCount = req.isConsecutive ? req.consecutiveSize : 1;
      if ((this.ctx.classDaySubjectCount[subjDayKey] || 0) + pendingCount > (req.maxPerDay || 2)) continue;

      const periods = this._getSortedPeriods(req.classId, day, req);

      if (req.isConsecutive) {
        if (this._placeConsecutive(req, day, periods, subjDayKey)) return;
      } else {
        if (this._placeSingle(req, day, periods, subjDayKey)) return;
      }
    }

    // Backtracking: if consecutive failed, try as singles
    if (req.isConsecutive && req.consecutivePreference !== 'required') {
      for (let i = 0; i < req.consecutiveSize; i++) {
        const singleReq = { ...req, isConsecutive: false, consecutiveSize: 1, duration: 1 };
        this._placeOneRegularBlock(singleReq);
      }
      return;
    }

    // Structured diagnostic for failure
    const failedReasons = this._diagnosePlacementFailure(req);
    const rootCause = this._deriveRootCause(req, failedReasons);
    this.errors.push({
      blockId: null,
      reason: req.isConsecutive ? FAILURE_CODES.NO_CONTINUOUS_SLOT :
              (req.blockType === 'activity' || req.blockType === 'club') ? FAILURE_CODES.ACTIVITY_NO_SLOT :
              FAILURE_CODES.NO_SLOT_AVAILABLE,
      message: req.isConsecutive
        ? `Could not place consecutive ${req.subjectName} for ${req.className}`
        : `Could not place ${req.subjectName} for ${req.className} (${req.teacherName})`,
      details: {
        teacher: { id: req.teacherId, name: req.teacherName },
        subject: { id: req.subjectId, name: req.subjectName },
        class: { id: req.classId, name: req.className },
        requiredDuration: req.isConsecutive ? req.consecutiveSize : 1,
        requiredRoomType: req.requiredRoomType,
        failedReasons
      },
      suggestions: this._generateSuggestions(req, failedReasons),
      type: 'regular_unplaced',
      affectedClass: req.className,
      affectedSubject: req.subjectName,
      affectedTeacher: req.teacherName,
      affectedRoom: req.requiredRoomType || 'classroom',
      rootCause,
      confidenceScore: this._computeConfidenceScore(failedReasons),
      classId: req.classId,
      subjectId: req.subjectId,
      teacherId: req.teacherId
    });
  }

  /**
   * Place consecutive blocks as ONE atomic multi-period block.
   * Component 1: True duration-aware placement.
   */
  _placeConsecutive(req, day, periods, subjDayKey) {
    // Find valid continuous slot chains for this day (break-crossing prevention)
    const chains = this._findContinuousSlotChains(req.classId, day, req.consecutiveSize);

    // Evaluate and score candidate chains
    const candidates = [];
    for (const chain of chains) {
      const result = this._evaluateChain(req, day, chain);
      if (result.valid) {
        candidates.push({ chain, room: result.room, score: result.score });
      }
    }

    // Pick the best scoring candidate (Component 3: scoring-guided)
    if (candidates.length === 0) return false;
    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];
    const candidateSlots = best.chain;
    const room = best.room;
    const tid = req.teacherId?.toString();

    // Create ONE atomic block with all periods (Component 1)
    const blockType = req.blockType ||
      (candidateSlots.length >= 3 ? 'triple_lab' :
       candidateSlots.length === 2 ? 'double_period' : 'normal');

    this.placedBlocks.push({
      timetable: this.timetableId,
      type: blockType,
      subject: req.subjectId,
      teacher: req.teacherId,
      room: room._id,
      classes: [req.classId],
      day,
      periods: candidateSlots,
      duration: candidateSlots.length,
      studentGroup: req.studentGroup || null,
      priorityWeight: req.priorityWeight
    });

    // Mark all slots for the atomic block
    for (const p of candidateSlots) {
      this._markClass(req.classId.toString(), day, p, req.studentGroup);
      if (tid) this._markTeacher(tid, day, p);
      this._markRoom(room._id.toString(), day, p);
    }
    this.ctx.classDaySubjectCount[subjDayKey] = (this.ctx.classDaySubjectCount[subjDayKey] || 0) + req.consecutiveSize;
    this._trackSubjectSpread(req.classId?.toString(), req.subjectId?.toString(), day);
    this._trackPeriodEdge(req.classId?.toString(), req.subjectId?.toString(), day, candidateSlots);
    return true;
  }

  /**
   * Evaluate whether a chain of slots is valid for a block placement.
   * Returns { valid, room, score }
   */
  _evaluateChain(req, day, chain) {
    const tid = req.teacherId?.toString();
    const cid = req.classId?.toString();

    // Check all slots in the chain
    let room = null;
    for (const period of chain) {
      if (this.ctx.classSchedule[`${cid}_${day}_${period}`]) return { valid: false };
      if (tid && this.ctx.teacherSchedule[`${tid}_${day}_${period}`]) return { valid: false };

      // Teacher unavailability
      if (tid) {
        const teacher = this.teacherMap.get(tid);
        if (teacher?.unavailableSlots?.find(u => u.day === day)?.periods?.includes(period)) {
          return { valid: false };
        }
      }

      // Room: same room must be available for ALL periods (Component 1)
      const r = this._findRoom(day, period, req.requiredRoomType || (req.requiresLab ? 'lab' : 'classroom'), req.studentCount, [], req.preferredRoom);
      if (!r) return { valid: false };
      if (!room) {
        room = r;
      } else if (room._id.toString() !== r._id.toString()) {
        // Check if the SAME room is available for this period too
        const sameRoomKey = `${room._id.toString()}_${day}_${period}`;
        if (this.ctx.roomSchedule[sameRoomKey]) return { valid: false };
      }
    }

    // Teacher daily/weekly limits
    if (tid) {
      const tdKey = `${tid}_${day}`;
      if ((this.ctx.teacherDayCount[tdKey] || 0) + chain.length > (req.teacherMaxPerDay || 6)) return { valid: false };
      if ((this.ctx.teacherWeekCount[tid] || 0) + chain.length > (req.teacherMaxPerWeek || 30)) return { valid: false };

      // Teacher continuous-period cap (Priority 3)
      const teacher = this.teacherMap.get(tid);
      const maxContinuous = teacher?.maxContinuousPeriods || 4;
      if (this._wouldExceedContinuous(tid, day, chain[0], chain.length, maxContinuous)) return { valid: false };
    }

    // Score this candidate (Component 3: workload balancing)
    const score = this._scoreCandidate(req, day, chain[0], chain.length);

    return { valid: true, room, score };
  }

  /**
   * Place a single period block with scoring-guided selection.
   * Component 3: Evaluate top candidates instead of first-valid.
   */
  _placeSingle(req, day, periods, subjDayKey) {
    const tid = req.teacherId?.toString();
    const cid = req.classId?.toString();
    const isFlexActivity = (req.blockType === 'activity' || req.blockType === 'club');
    const teacherOptional = isFlexActivity && !tid;
    const candidates = [];

    for (const period of periods) {
      if (this.ctx.classSchedule[`${cid}_${day}_${period}`]) continue;

      // Teacher checks (skip if activity/club with no assigned teacher)
      if (tid) {
        if (this.ctx.teacherSchedule[`${tid}_${day}_${period}`]) continue;

        // Teacher limits
        const tdKey = `${tid}_${day}`;
        if ((this.ctx.teacherDayCount[tdKey] || 0) >= (req.teacherMaxPerDay || 6)) continue;
        if ((this.ctx.teacherWeekCount[tid] || 0) >= (req.teacherMaxPerWeek || 30)) continue;

        // Teacher unavailability
        const teacher = this.teacherMap.get(tid);
        if (teacher?.unavailableSlots?.find(u => u.day === day)?.periods?.includes(period)) continue;

        // Teacher continuous-period cap (Priority 3)
        const maxContinuous = teacher?.maxContinuousPeriods || 4;
        if (this._wouldExceedContinuous(tid, day, period, 1, maxContinuous)) continue;
      }

      // Room search: flexible for activity/club if specialty not found
      let room;
      if (isFlexActivity) {
        room = this._findRoom(day, period, req.requiredRoomType || 'classroom', req.studentCount, [], req.preferredRoom);
        if (!room) room = this._findRoom(day, period, 'classroom', req.studentCount, []);
        if (!room) room = this._findRoom(day, period, null, req.studentCount, []);
      } else {
        room = this._findRoom(day, period, req.requiredRoomType || (req.requiresLab ? 'lab' : 'classroom'), req.studentCount, [], req.preferredRoom);
      }
      if (!room) continue;

      const score = this._scoreCandidate(req, day, period, 1);
      candidates.push({ period, room, score });

      // Collect top 3 candidates max for efficiency
      if (candidates.length >= 3) break;
    }

    if (candidates.length === 0) return false;

    // Pick the best scoring candidate
    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];

    this.placedBlocks.push({
      timetable: this.timetableId,
      type: req.studentGroup ? 'split_group' : (req.blockType || 'normal'),
      subject: req.subjectId,
      teacher: req.teacherId || null,
      room: best.room._id,
      classes: [req.classId],
      day,
      periods: [best.period],
      duration: 1,
      studentGroup: req.studentGroup || null,
      priorityWeight: req.priorityWeight
    });

    this._markClass(cid, day, best.period, req.studentGroup);
    if (tid) this._markTeacher(tid, day, best.period);
    this._markRoom(best.room._id.toString(), day, best.period);
    this.ctx.classDaySubjectCount[subjDayKey] = (this.ctx.classDaySubjectCount[subjDayKey] || 0) + 1;
    this._trackSubjectSpread(cid, req.subjectId?.toString(), day);
    this._trackPeriodEdge(cid, req.subjectId?.toString(), day, [best.period]);
    return true;
  }

  // ═══════════════════════════════════════════════════════════════════
  // BREAK BLOCKS (for visualization)
  // ═══════════════════════════════════════════════════════════════════
  _placeBreakBlocks() {
    for (const cls of this.classes) {
      const workingDays = this._getClassWorkingDays(cls._id);
      for (const day of workingDays) {
        const cp = this.classPeriodMap[cls._id.toString()];
        const breaks = cp?.dayBreaks?.[day] || [];
        for (const bp of breaks) {
          this.placedBlocks.push({
            timetable: this.timetableId,
            type: 'reserved',
            classes: [cls._id],
            day,
            periods: [bp],
            duration: 1,
            isLocked: true
          });
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // SCORING ENGINE (Component 3: Workload Balancing)
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Score a candidate placement. Higher = better.
   * Considers teacher workload balance, subject distribution, timing, and spread.
   */
  _scoreCandidate(req, day, period, duration = 1) {
    let score = 100;
    const tid = req.teacherId?.toString();
    const cid = req.classId?.toString();
    const sid = req.subjectId?.toString();

    // ── Teacher daily load penalty ──
    if (tid) {
      const dayLoad = this.ctx.teacherDayCount[`${tid}_${day}`] || 0;
      score -= dayLoad * 8;
    }

    // ── Teacher weekly load penalty ──
    if (tid) {
      const weekLoad = this.ctx.teacherWeekCount[tid] || 0;
      score -= Math.max(0, weekLoad - 20) * 3;
    }

    // ── Subject-day excess penalty ──
    if (cid && sid) {
      const subjDayCount = this.ctx.classDaySubjectCount[`${cid}_${sid}_${day}`] || 0;
      score -= subjDayCount * 15;
    }

    // ── Subject spread bonus (Component 5) ──
    // Prefer days where this subject hasn't been placed yet
    if (cid && sid) {
      const spreadKey = `${cid}_${sid}`;
      const spread = this._subjectDaySpread[spreadKey];
      if (spread && spread.has(day)) {
        score -= 10; // Already placed on this day
      } else {
        score += 5; // New day — improves spread
      }
    }

    // ── Timing preference bonuses ──
    if (req.preferMorning && period <= 4) score += 5;
    else if (req.preferMorning && period > 4) score -= 5;
    if (req.preferAfternoon && period > 4) score += 5;
    else if (req.preferAfternoon && period <= 4) score -= 5;

    // ── First/last period balance (Component 5) ──
    if (cid && sid) {
      const daySlots = this._getClassDaySlots(req.classId, day);
      if (daySlots.length > 0) {
        const firstSlot = Math.min(...daySlots);
        const lastSlot = Math.max(...daySlots);
        if (period === firstSlot || period === lastSlot) {
          const edgeKey = `${cid}_${period === firstSlot ? 'first' : 'last'}`;
          const edgeData = this._periodEdgeTracker[edgeKey] || {};
          const sidCount = edgeData[sid] || 0;
          if (sidCount >= 2) score -= 12; // Same subject too often at edge
        }
      }
    }

    return score;
  }

  // ═══════════════════════════════════════════════════════════════════
  // CONTINUOUS SLOT CHAINS (Component 1: Break-crossing prevention)
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Find all valid continuous slot chains of the given size for a class on a day.
   * Filters out sequences that cross breaks.
   */
  _findContinuousSlotChains(classId, day, size) {
    const daySlots = this._getClassDaySlots(classId, day);
    if (daySlots.length < size) return [];

    const chains = [];
    for (let i = 0; i <= daySlots.length - size; i++) {
      const chain = daySlots.slice(i, i + size);

      // Verify truly consecutive (no gaps, no break crossing)
      let valid = true;
      for (let j = 0; j < chain.length - 1; j++) {
        if (!this._areConsecutive(classId, day, chain[j], chain[j + 1])) {
          valid = false;
          break;
        }
      }
      if (valid) chains.push(chain);
    }

    return chains;
  }

  // ═══════════════════════════════════════════════════════════════════
  // STRUCTURED DIAGNOSTICS (Component 4)
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Diagnose why a placement failed — returns array of reason strings.
   */
  _diagnosePlacementFailure(req) {
    const reasons = [];
    const cid = req.classId?.toString();
    const tid = req.teacherId?.toString();
    const workingDays = req.workingDays || [];

    for (const day of workingDays) {
      const periods = this._getClassDaySlots(req.classId, day);
      let classBusy = 0, teacherBusy = 0, noRoom = 0, teacherUnavail = 0;

      for (const p of periods) {
        if (this.ctx.classSchedule[`${cid}_${day}_${p}`]) { classBusy++; continue; }
        if (tid && this.ctx.teacherSchedule[`${tid}_${day}_${p}`]) { teacherBusy++; continue; }
        if (tid) {
          const teacher = this.teacherMap.get(tid);
          if (teacher?.unavailableSlots?.find(u => u.day === day)?.periods?.includes(p)) { teacherUnavail++; continue; }
        }
        const room = this._findRoom(day, p, req.requiredRoomType || 'classroom', req.studentCount);
        if (!room) noRoom++;
      }

      if (classBusy === periods.length) reasons.push(`class_full_${day}`);
      if (teacherBusy > periods.length * 0.7) reasons.push(`teacher_busy_${day}`);
      if (teacherUnavail > 0) reasons.push(`teacher_unavailable_${day}`);
      if (noRoom > periods.length * 0.5) reasons.push(`no_room_${day}`);
    }

    // Check teacher overloads
    if (tid) {
      const weekLoad = this.ctx.teacherWeekCount[tid] || 0;
      if (weekLoad >= (req.teacherMaxPerWeek || 30)) reasons.push('teacher_week_overloaded');
      for (const day of workingDays) {
        const dayLoad = this.ctx.teacherDayCount[`${tid}_${day}`] || 0;
        if (dayLoad >= (req.teacherMaxPerDay || 6)) reasons.push(`teacher_day_max_${day}`);
      }
    }

    if (req.isConsecutive) {
      // Check for break-crossing issues
      let chainCount = 0;
      for (const day of workingDays) {
        chainCount += this._findContinuousSlotChains(req.classId, day, req.consecutiveSize).length;
      }
      if (chainCount === 0) reasons.push('no_valid_continuous_chains');
    }

    return reasons.length > 0 ? reasons : ['unknown_constraint'];
  }

  /**
   * Generate contextual suggestions based on failure reasons.
   */
  _generateSuggestions(req, failedReasons) {
    const suggestions = [];
    const reasonStr = failedReasons.join(',');

    if (req.isConsecutive) {
      suggestions.push({
        action: 'relax_consecutive',
        description: 'Allow non-consecutive placement as separate singles',
        confidence: 80
      });
    }

    if (reasonStr.includes('teacher_busy') || reasonStr.includes('teacher_week_overloaded') || reasonStr.includes('teacher_day_max')) {
      suggestions.push({
        action: 'change_teacher',
        description: 'Assign alternate qualified teacher with more availability',
        confidence: 60
      });
      suggestions.push({
        action: 'reduce_load',
        description: 'Reduce teacher weekly load by reassigning other subjects',
        confidence: 40
      });
    }

    if (reasonStr.includes('no_room')) {
      suggestions.push({
        action: 'add_room',
        description: `Add more ${req.requiredRoomType || 'classroom'} rooms or relax room type requirement`,
        confidence: 55
      });
    }

    if (reasonStr.includes('class_full')) {
      suggestions.push({
        action: 'reduce_class_load',
        description: 'Reduce total periods per week for this class',
        confidence: 45
      });
    }

    if (reasonStr.includes('no_valid_continuous_chains')) {
      suggestions.push({
        action: 'adjust_breaks',
        description: 'Adjust break timings to allow longer continuous chains',
        confidence: 50
      });
    }

    if (suggestions.length === 0) {
      suggestions.push({
        action: 'manual_review',
        description: 'Manually review and adjust constraints',
        confidence: 30
      });
    }

    return suggestions;
  }

  /**
   * Derive a human-readable root cause from failure reasons.
   */
  _deriveRootCause(req, failedReasons) {
    const rStr = failedReasons.join(',');
    if (rStr.includes('teacher_week_overloaded')) return `${req.teacherName} has reached their weekly period limit`;
    if (rStr.includes('teacher_day_max')) return `${req.teacherName} is at daily max on all available days`;
    if (rStr.includes('teacher_busy')) return `${req.teacherName} is busy during all available class slots`;
    if (rStr.includes('teacher_unavailable')) return `${req.teacherName} is marked unavailable during available slots`;
    if (rStr.includes('class_full')) return `${req.className} has no free periods remaining`;
    if (rStr.includes('no_room')) return `No ${req.requiredRoomType || 'classroom'} room available when class and teacher are free`;
    if (rStr.includes('no_valid_continuous_chains')) return `No ${req.consecutiveSize}-period continuous chain available (breaks may be splitting available slots)`;
    if (rStr.includes('teacher_continuous')) return `Placing this would exceed ${req.teacherName}'s continuous period limit`;
    return 'Multiple constraints prevent placement — see details for per-day analysis';
  }

  /**
   * Compute confidence score for suggestions based on failure reasons.
   */
  _computeConfidenceScore(failedReasons) {
    const rStr = failedReasons.join(',');
    if (rStr.includes('class_full')) return 35; // Hardest to fix
    if (rStr.includes('teacher_week_overloaded')) return 45;
    if (rStr.includes('no_room')) return 60;
    if (rStr.includes('teacher_busy')) return 55;
    if (rStr.includes('no_valid_continuous_chains')) return 50;
    return 40;
  }

  /**
   * Diagnose split-pair failure with per-slot tracking.
   */
  _diagnoseSplitPairFailure(pair) {
    const failedSlots = [];
    const classId = pair.classId;
    const blocks = pair.blocks;
    const workingDays = this._getClassWorkingDays(classId);

    for (const day of workingDays) {
      const periods = this._getClassDaySlots(classId, day);
      for (const period of periods) {
        const classKey = `${classId}_${day}_${period}`;
        const existing = this.ctx.classSchedule[classKey];
        if (existing === true) {
          failedSlots.push({ day, period, reason: 'Class slot occupied by whole-class block' });
          continue;
        }
        let blockFailures = [];
        for (const block of blocks) {
          const tid = block.teacherId?.toString();
          if (tid && this.ctx.teacherSchedule[`${tid}_${day}_${period}`]) {
            blockFailures.push({ group: block.studentGroup, reason: `Teacher ${block.teacherName} busy` });
          } else {
            const room = this._findRoom(day, period, block.requiredRoomType || 'classroom', block.studentCount);
            if (!room) blockFailures.push({ group: block.studentGroup, reason: `No ${block.requiredRoomType || 'classroom'} room` });
          }
        }
        if (blockFailures.length > 0) {
          failedSlots.push({ day, period, reason: blockFailures.map(f => `${f.group}: ${f.reason}`).join('; ') });
        }
      }
    }
    return failedSlots.slice(0, 10); // Cap at 10 for readability
  }

  // ═══════════════════════════════════════════════════════════════════
  // TEACHER CONTINUOUS-PERIOD CAP (Priority 3)
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Check if placing a block at (tid, day, startPeriod) for `duration` periods
   * would create a continuous chain exceeding maxContinuous.
   */
  _wouldExceedContinuous(tid, day, startPeriod, duration, maxContinuous) {
    if (!tid || !maxContinuous) return false;

    // Find the full chain that would exist after placement
    let chainStart = startPeriod;
    let chainEnd = startPeriod + duration - 1;

    // Extend backwards: check earlier periods
    while (chainStart > 0) {
      const prevKey = `${tid}_${day}_${chainStart - 1}`;
      if (this.ctx.teacherSchedule[prevKey]) {
        chainStart--;
      } else break;
    }

    // Extend forwards: check later periods
    while (true) {
      const nextKey = `${tid}_${day}_${chainEnd + 1}`;
      if (this.ctx.teacherSchedule[nextKey]) {
        chainEnd++;
      } else break;
    }

    const totalChain = chainEnd - chainStart + 1;
    return totalChain > maxContinuous;
  }

  // ═══════════════════════════════════════════════════════════════════
  // RELAXED RETRY SWEEP (Priority 3)
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Second pass for failed blocks with relaxed constraints.
   * Drops morning/afternoon preferences, avoidDays, and increases maxPerDay.
   */
  _retryFailedBlocks(regularBlocks) {
    if (this.errors.length === 0) return;

    // Collect errors that are retryable (regular_unplaced only)
    const retryable = this.errors.filter(e => e.type === 'regular_unplaced');
    if (retryable.length === 0) return;

    const retried = [];
    for (const err of retryable) {
      // Reconstruct a relaxed version of the requirement
      const relaxedReq = {
        classId: err.classId,
        className: err.details?.class?.name || '',
        subjectId: err.subjectId,
        subjectName: err.details?.subject?.name || '',
        teacherId: err.teacherId,
        teacherName: err.details?.teacher?.name || '',
        requiredRoomType: err.details?.requiredRoomType || 'classroom',
        studentCount: 30,
        workingDays: this._getClassWorkingDays(err.classId),
        maxPerDay: (err.details?.subject?.maxPerDay || 2) + 1, // Relaxed: +1
        preferMorning: false,  // Dropped
        preferAfternoon: false, // Dropped
        avoidDays: [],          // Dropped
        preferredDays: [],
        isConsecutive: false,
        consecutiveSize: 1,
        duration: 1,
        blockType: 'normal',
        teacherMaxPerDay: 7,    // Relaxed: +1
        teacherMaxPerWeek: 32,  // Relaxed: +2
        priorityWeight: 30
      };

      // Try placement with relaxed constraints
      const dayOrder = [...relaxedReq.workingDays];
      this.rng.shuffle(dayOrder);
      let placed = false;

      for (const day of dayOrder) {
        const cid = relaxedReq.classId?.toString();
        const sid = relaxedReq.subjectId?.toString();
        const subjDayKey = `${cid}_${sid}_${day}`;
        if ((this.ctx.classDaySubjectCount[subjDayKey] || 0) >= relaxedReq.maxPerDay) continue;

        const periods = this._getSortedPeriods(relaxedReq.classId, day, relaxedReq);
        if (this._placeSingle(relaxedReq, day, periods, subjDayKey)) {
          placed = true;
          break;
        }
      }

      if (placed) retried.push(err);
    }

    // Remove successfully retried errors
    for (const err of retried) {
      const idx = this.errors.indexOf(err);
      if (idx !== -1) this.errors.splice(idx, 1);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // SUBJECT SPREAD TRACKING (Component 5)
  // ═══════════════════════════════════════════════════════════════════

  _trackSubjectSpread(classId, subjectId, day) {
    if (!classId || !subjectId) return;
    const key = `${classId}_${subjectId}`;
    if (!this._subjectDaySpread[key]) this._subjectDaySpread[key] = new Set();
    this._subjectDaySpread[key].add(day);
  }

  _trackPeriodEdge(classId, subjectId, day, periods) {
    if (!classId || !subjectId || !periods.length) return;
    const daySlots = this._getClassDaySlots(classId, day);
    if (daySlots.length === 0) return;
    const firstSlot = Math.min(...daySlots);
    const lastSlot = Math.max(...daySlots);
    for (const p of periods) {
      if (p === firstSlot || p === lastSlot) {
        const edgeKey = `${classId}_${p === firstSlot ? 'first' : 'last'}`;
        if (!this._periodEdgeTracker[edgeKey]) this._periodEdgeTracker[edgeKey] = {};
        this._periodEdgeTracker[edgeKey][subjectId] = (this._periodEdgeTracker[edgeKey][subjectId] || 0) + 1;
      }
    }
  }

  /**
   * Sort days to prefer days where this subject hasn't been placed yet.
   * Component 5: Subject-spread-across-week.
   */
  _sortDaysBySpread(dayOrder, classId, subjectId) {
    if (!classId || !subjectId) return;
    const spreadKey = `${classId}_${subjectId}`;
    const spread = this._subjectDaySpread[spreadKey];
    if (!spread || spread.size === 0) return;

    // Stable sort: unplaced days first
    dayOrder.sort((a, b) => {
      const aPlaced = spread.has(a) ? 1 : 0;
      const bPlaced = spread.has(b) ? 1 : 0;
      return aPlaced - bPlaced;
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════
  _markTeacher(tid, day, period) {
    this.ctx.teacherSchedule[`${tid}_${day}_${period}`] = true;
    const dk = `${tid}_${day}`;
    this.ctx.teacherDayCount[dk] = (this.ctx.teacherDayCount[dk] || 0) + 1;
    this.ctx.teacherWeekCount[tid] = (this.ctx.teacherWeekCount[tid] || 0) + 1;
  }

  _markRoom(rid, day, period) {
    this.ctx.roomSchedule[`${rid}_${day}_${period}`] = true;
  }

  _markClass(cid, day, period, groupName) {
    const key = `${cid}_${day}_${period}`;
    if (groupName) {
      // Split group — mark with group name so other groups can share
      const existing = this.ctx.classSchedule[key];
      if (typeof existing === 'string' && existing.startsWith('split:')) {
        this.ctx.classSchedule[key] = `${existing},${groupName}`;
      } else {
        this.ctx.classSchedule[key] = `split:${groupName}`;
      }
    } else {
      this.ctx.classSchedule[key] = true; // Whole-class block
    }
  }

  _getClassWorkingDays(classId) {
    const cp = this.classPeriodMap[classId.toString()];
    return cp?.workingDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  }

  _getClassDaySlots(classId, day) {
    const cp = this.classPeriodMap[classId.toString()];
    return cp?.daySlots?.[day] || [];
  }

  _getCommonWorkingDays(classIds) {
    const daysSets = classIds.map(cid => this._getClassWorkingDays(cid));
    return daysSets.reduce((common, days) => common.filter(d => days.includes(d)), daysSets[0] || []);
  }

  _getCommonDaySlots(classIds, day) {
    const slotSets = classIds.map(cid => this._getClassDaySlots(cid, day));
    return slotSets.reduce((common, slots) => common.filter(s => slots.includes(s)), slotSets[0] || []);
  }

  _getSortedPeriods(classId, day, req) {
    const periods = [...this._getClassDaySlots(classId, day)];
    if (req.preferMorning) periods.sort((a, b) => a - b);
    else if (req.preferAfternoon) periods.sort((a, b) => b - a);
    else this.rng.shuffle(periods);
    return periods;
  }

  _areConsecutive(classId, day, p1, p2) {
    if (Math.abs(p1 - p2) !== 1) return false;
    const cp = this.classPeriodMap[classId.toString()];
    if (!cp) return true;
    const minP = Math.min(p1, p2);
    const maxP = Math.max(p1, p2);
    const daySlots = cp.daySlots?.[day] || [];
    if (!daySlots.includes(minP) || !daySlots.includes(maxP)) return false;
    const dayBreaks = cp.dayBreaks?.[day] || [];
    for (const b of dayBreaks) {
      if (b > minP && b < maxP) return false;
      // Also check if break IS one of the periods (can't schedule in a break)
      if (b === minP || b === maxP) return false;
    }
    return true;
  }

  /**
   * Enhanced room search with multi-pass type matching (Component 2).
   * Pass 1: Preferred room (from SubjectRequirement)
   * Pass 2: Exact room type + capacity
   * Pass 3: Compatible room type + capacity
   * Pass 4: Any room with capacity
   * Pass 5: Any available room
   */
  _findRoom(day, period, requiredRoomType, studentCount, excludeIds = [], preferredRoomId = null) {
    const excludeSet = excludeIds.length > 0 ? new Set(excludeIds) : null;
    const isExcluded = (rid) => excludeSet && excludeSet.has(rid);
    const isAvailable = (room) => {
      const rid = room._id.toString();
      if (isExcluded(rid)) return false;
      if (this.ctx.roomSchedule[`${rid}_${day}_${period}`]) return false;
      const unavail = room.unavailableSlots?.find(u => u.day === day);
      if (unavail?.periods?.includes(period)) return false;
      return true;
    };

    // Pass 1: Preferred room from SubjectRequirement
    if (preferredRoomId) {
      const prefId = preferredRoomId.toString();
      const prefRoom = this.allRoomsSorted.find(r => r._id.toString() === prefId);
      if (prefRoom && isAvailable(prefRoom)) return prefRoom;
    }

    // Normalize room type
    const roomType = requiredRoomType || 'classroom';

    // Pass 2: Exact room type + capacity
    const exactBucket = this.roomsByType[roomType] || [];
    for (const room of exactBucket) {
      if (room.capacity >= studentCount && isAvailable(room)) return room;
    }

    // Pass 3: Compatible room type + capacity
    const compatTypes = ROOM_COMPAT[roomType] || [roomType];
    for (const compatType of compatTypes) {
      if (compatType === roomType) continue; // Already tried
      const compatBucket = this.roomsByType[compatType] || [];
      for (const room of compatBucket) {
        if (room.capacity >= studentCount && isAvailable(room)) return room;
      }
    }

    // Pass 4: Any room with capacity
    for (const room of this.allRoomsSorted) {
      if (room.capacity >= studentCount && isAvailable(room)) return room;
    }

    // Pass 5: Any available room at all
    for (const room of this.allRoomsSorted) {
      if (isAvailable(room)) return room;
    }

    return null;
  }
}

// Export failure codes for use by other modules
PlacementEngine.FAILURE_CODES = FAILURE_CODES;

module.exports = PlacementEngine;
