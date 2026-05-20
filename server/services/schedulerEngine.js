const LessonBlock = require('../models/LessonBlock');
const GeneratedTimetable = require('../models/GeneratedTimetable');
const SubjectRequirement = require('../models/SubjectRequirement');
const SubjectCombinationRule = require('../models/SubjectCombinationRule');
const ReservedPeriodRule = require('../models/ReservedPeriodRule');
const Class = require('../models/Class');
const Room = require('../models/Room');
const Teacher = require('../models/Teacher');
const School = require('../models/School');
const ConflictLog = require('../models/ConflictLog');

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
    this.timeslots = []; // period numbers that are schedulable
    this.breakPeriods = [];
    this.teacherSchedule = {};
    this.roomSchedule = {};
    this.classSchedule = {};
    this.teacherDayCount = {};
    this.teacherContinuous = {};
    this.classDaySubjectCount = {};
    this.errors = [];
    this.blocks = [];
    this.timetable = null;
  }

  async generate() {
    const startTime = Date.now();
    // 1. Load all data
    this.school = await School.findById(this.schoolId);
    if (!this.school) throw new Error('School not found');

    this.classes = await Class.find({ school: this.schoolId, session: this.sessionId, isActive: true });
    this.rooms = await Room.find({ school: this.schoolId, isAvailable: true });
    this.teachers = await Teacher.find({ school: this.schoolId, session: this.sessionId, status: 'active' });
    this.requirements = await SubjectRequirement.find({ school: this.schoolId, session: this.sessionId, isActive: true }).populate('subject teacher class');
    this.combinationRules = await SubjectCombinationRule.find({ school: this.schoolId, session: this.sessionId, isActive: true }).populate('subject teacher room appliesTo.class');
    this.reservedRules = await ReservedPeriodRule.find({ school: this.schoolId, session: this.sessionId, isActive: true }).populate('subject teacher room');

    if (this.classes.length === 0) throw new Error('No classes found');
    if (this.rooms.length === 0) throw new Error('No rooms found');

    const workingDays = this.school.settings.workingDays || DAYS;
    const totalPeriods = this.school.settings.defaultPeriodsPerDay || 8;
    const breakPeriod = this.school.settings.defaultBreakPeriod || 4;
    this.breakPeriods = [breakPeriod];
    this.timeslots = [];
    for (let i = 1; i <= totalPeriods; i++) {
      if (i !== breakPeriod) this.timeslots.push(i);
    }

    // 2. Create timetable record
    this.timetable = await GeneratedTimetable.create({
      school: this.schoolId, session: this.sessionId,
      name: `Timetable v${Date.now()}`,
      status: 'generating', generatedAt: new Date()
    });

    // 3. Place reserved period rules first (assembly, activities etc.)
    await this._placeReservedRules(workingDays);

    // 4. Place combination rules (combined classes)
    await this._placeCombinationRules(workingDays);

    // 5. Place regular subject requirements
    await this._placeRegularRequirements(workingDays);

    // 6. Place break blocks
    for (const cls of this.classes) {
      for (const day of workingDays) {
        for (const bp of this.breakPeriods) {
          this.blocks.push({
            timetable: this.timetable._id, type: 'reserved',
            classes: [cls._id], day, periods: [bp], isLocked: true
          });
        }
      }
    }

    // 7. Save all blocks
    if (this.blocks.length > 0) {
      await LessonBlock.insertMany(this.blocks, { ordered: false }).catch(() => {});
    }

    // 8. Run conflict detection
    const conflicts = await this._detectConflicts();

    // 9. Update timetable stats
    const elapsed = Date.now() - startTime;
    this.timetable.stats = {
      totalBlocks: this.blocks.length,
      placedBlocks: this.blocks.length - this.errors.length,
      unplacedBlocks: this.errors.length,
      hardConflicts: conflicts.length,
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
      timeMs: elapsed
    };
  }

  async _placeReservedRules(workingDays) {
    for (const rule of this.reservedRules) {
      if (!workingDays.includes(rule.day)) continue;
      const targetClasses = rule.appliesTo.length > 0
        ? rule.appliesTo.map(a => a.class?._id || a.class).filter(Boolean)
        : this.classes.map(c => c._id);

      const block = {
        timetable: this.timetable._id, type: 'reserved',
        subject: rule.subject?._id, teacher: rule.teacher?._id, room: rule.room?._id,
        classes: targetClasses, day: rule.day, periods: rule.periods,
        isLocked: rule.isLocked
      };
      this.blocks.push(block);

      // Mark schedules
      for (const p of rule.periods) {
        for (const cid of targetClasses) this._markClass(cid.toString(), rule.day, p);
        if (rule.teacher) this._markTeacher(rule.teacher._id.toString(), rule.day, p);
        if (rule.room) this._markRoom(rule.room._id.toString(), rule.day, p);
      }
    }
  }

  async _placeCombinationRules(workingDays) {
    for (const rule of this.combinationRules) {
      const classIds = rule.appliesTo.map(a => a.class?._id || a.class).filter(Boolean);
      if (classIds.length === 0) continue;
      let placed = 0;
      const daysOrder = rule.preferredDays.length > 0 ? [...rule.preferredDays, ...workingDays.filter(d => !rule.preferredDays.includes(d))] : [...workingDays];
      this._shuffle(daysOrder);

      for (let i = 0; i < rule.periodsPerWeek; i++) {
        let didPlace = false;
        for (const day of daysOrder) {
          if (didPlace) break;
          const periods = rule.preferredPeriods.length > 0 ? [...rule.preferredPeriods, ...this.timeslots.filter(p => !rule.preferredPeriods.includes(p))] : [...this.timeslots];

          for (const period of periods) {
            if (didPlace) break;
            // Check all classes free
            const allClassesFree = classIds.every(cid => !this.classSchedule[`${cid}_${day}_${period}`]);
            if (!allClassesFree) continue;
            // Check teacher free
            const tid = rule.teacher?._id?.toString();
            if (tid && this.teacherSchedule[`${tid}_${day}_${period}`]) continue;
            // Check room free
            const rid = rule.room?._id?.toString();
            if (rid && this.roomSchedule[`${rid}_${day}_${period}`]) continue;
            // Find room if not specified
            let roomId = rid;
            if (!roomId) {
              const room = this._findRoom(day, period, false, Math.max(...classIds.map(cid => { const c = this.classes.find(cl => cl._id.toString() === cid.toString()); return c?.studentCount || 30; })));
              if (room) roomId = room._id.toString();
            }

            this.blocks.push({
              timetable: this.timetable._id, type: 'combined_class',
              subject: rule.subject?._id, teacher: rule.teacher?._id,
              room: roomId ? require('mongoose').Types.ObjectId.createFromHexString(roomId) : undefined,
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

  async _placeRegularRequirements(workingDays) {
    // Build requirement list, shuffle for variety
    const reqs = [];
    for (const req of this.requirements) {
      // Skip if covered by combination rule
      const coveredByCombination = this.combinationRules.some(cr =>
        cr.subject?._id?.toString() === req.subject?._id?.toString() &&
        cr.appliesTo.some(a => (a.class?._id || a.class)?.toString() === req.class?._id?.toString())
      );
      if (coveredByCombination) continue;

      for (let i = 0; i < req.periodsPerWeek; i++) {
        reqs.push({
          classId: req.class._id, className: req.class.name,
          subjectId: req.subject._id, subjectName: req.subject.name,
          teacherId: req.teacher._id, teacherName: req.teacher.name,
          requiresLab: req.subject.requiresLab, preferMorning: req.subject.preferMorning,
          preferAfternoon: req.subject.preferAfternoon, maxPerDay: req.subject.maxPerDay || 2,
          studentGroup: req.studentGroup, studentCount: req.class?.studentCount || 30,
          teacherMaxPerDay: req.teacher.maxPeriodsPerDay || 6,
          preferredDays: req.preferredDays || [], avoidDays: req.avoidDays || [],
          color: req.subject.color
        });
      }
    }
    this._shuffle(reqs);

    for (const req of reqs) {
      let placed = false;
      const dayOrder = req.preferredDays.length > 0
        ? [...req.preferredDays, ...workingDays.filter(d => !req.preferredDays.includes(d))]
        : [...workingDays];
      this._shuffle(dayOrder);

      for (const day of dayOrder) {
        if (placed) break;
        if (req.avoidDays.includes(day)) continue;
        // Check subject-per-day limit
        const subjDayKey = `${req.classId}_${req.subjectId}_${day}`;
        if ((this.classDaySubjectCount[subjDayKey] || 0) >= req.maxPerDay) continue;

        const periods = this._getSortedPeriods(req);
        for (const period of periods) {
          if (placed) break;
          const cKey = `${req.classId}_${day}_${period}`;
          if (this.classSchedule[cKey]) continue;
          const tKey = `${req.teacherId}_${day}_${period}`;
          if (this.teacherSchedule[tKey]) continue;
          // Teacher day load check
          const tdKey = `${req.teacherId}_${day}`;
          if ((this.teacherDayCount[tdKey] || 0) >= req.teacherMaxPerDay) continue;
          // Teacher unavailable slot check
          const teacher = this.teachers.find(t => t._id.toString() === req.teacherId.toString());
          if (teacher?.unavailableSlots) {
            const unavail = teacher.unavailableSlots.find(u => u.day === day);
            if (unavail && unavail.periods.includes(period)) continue;
          }
          // Find room
          const room = this._findRoom(day, period, req.requiresLab, req.studentCount);
          if (!room) continue;

          const blockType = req.studentGroup ? 'split_group' : 'normal';
          this.blocks.push({
            timetable: this.timetable._id, type: blockType,
            subject: req.subjectId, teacher: req.teacherId, room: room._id,
            classes: [req.classId], day, periods: [period],
            studentGroup: req.studentGroup || null
          });

          this._markClass(req.classId.toString(), day, period);
          this._markTeacher(req.teacherId.toString(), day, period);
          this._markRoom(room._id.toString(), day, period);
          this.classDaySubjectCount[subjDayKey] = (this.classDaySubjectCount[subjDayKey] || 0) + 1;
          placed = true;
        }
      }
      if (!placed) {
        this.errors.push({ message: `Could not place ${req.subjectName} for ${req.className} (${req.teacherName})`, classId: req.classId, subjectId: req.subjectId, teacherId: req.teacherId });
      }
    }
  }

  _getSortedPeriods(req) {
    const periods = [...this.timeslots];
    if (req.preferMorning) periods.sort((a, b) => a - b);
    else if (req.preferAfternoon) periods.sort((a, b) => b - a);
    else this._shuffle(periods);
    return periods;
  }

  _findRoom(day, period, requiresLab, studentCount) {
    const targetType = requiresLab ? 'lab' : 'classroom';
    for (const room of this.rooms) {
      if (room.type === targetType && room.capacity >= studentCount) {
        const key = `${room._id}_${day}_${period}`;
        if (!this.roomSchedule[key]) {
          const unavail = room.unavailableSlots?.find(u => u.day === day);
          if (!unavail || !unavail.periods.includes(period)) return room;
        }
      }
    }
    for (const room of this.rooms) {
      if (room.capacity >= studentCount) {
        const key = `${room._id}_${day}_${period}`;
        if (!this.roomSchedule[key]) return room;
      }
    }
    for (const room of this.rooms) {
      const key = `${room._id}_${day}_${period}`;
      if (!this.roomSchedule[key]) return room;
    }
    return null;
  }

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
          // Check if they're part of the same combined block
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
    }
    return conflicts;
  }

  _markTeacher(tid, day, period) {
    this.teacherSchedule[`${tid}_${day}_${period}`] = true;
    const dk = `${tid}_${day}`;
    this.teacherDayCount[dk] = (this.teacherDayCount[dk] || 0) + 1;
  }
  _markRoom(rid, day, period) { this.roomSchedule[`${rid}_${day}_${period}`] = true; }
  _markClass(cid, day, period) { this.classSchedule[`${cid}_${day}_${period}`] = true; }
  _shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }
}

module.exports = SchedulerEngine;
