const mongoose = require('mongoose');
const Absence = require('../models/Absence');
const LessonBlock = require('../models/LessonBlock');
const Teacher = require('../models/Teacher');
const Substitution = require('../models/Substitution');
const GeneratedTimetable = require('../models/GeneratedTimetable');
const AuditLog = require('../models/AuditLog');
const School = require('../models/School');
const AcademicSession = require('../models/AcademicSession');

const getScope = async () => {
  const school = await School.findOne();
  const session = await AcademicSession.findOne({ school: school?._id, isCurrent: true });
  return { school: school?._id, session: session?._id };
};

const DAYS_MAP = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Get day name from a Date object
 */
function getDayName(date) {
  return DAYS_MAP[new Date(date).getDay()];
}

/**
 * Get all dates between start and end (inclusive)
 */
function getDateRange(start, end) {
  const dates = [];
  const current = new Date(start);
  const last = new Date(end);
  while (current <= last) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

/**
 * Create a new absence with auto-replacement
 */
exports.createAbsence = async (req, res, next) => {
  try {
    const scope = await getScope();
    const { teacher, date, absenceType, endDate, affectedPeriods, reason } = req.body;

    if (!teacher || !date) {
      return res.status(400).json({ success: false, error: 'teacher and date are required' });
    }

    // 1. Create absence with status 'active'
    const absence = await Absence.create({
      school: scope.school,
      session: scope.session,
      teacher,
      date: new Date(date),
      endDate: endDate ? new Date(endDate) : undefined,
      absenceType: absenceType || 'full_day',
      affectedPeriods: affectedPeriods || [],
      reason: reason || '',
      status: 'active',
      createdBy: req.body.createdBy || undefined,
      autoReplacementAttempted: false
    });

    // 2. Determine dates to process
    let datesToProcess = [new Date(date)];
    if (absenceType === 'date_range' && endDate) {
      datesToProcess = getDateRange(date, endDate);
    }

    // 3. Find the active timetable
    const activeTimetable = await GeneratedTimetable.findOne({
      school: scope.school, session: scope.session,
      status: { $in: ['published', 'draft'] }
    }).sort({ createdAt: -1 });

    const allAffectedBlocks = [];

    if (activeTimetable) {
      for (const processDate of datesToProcess) {
        const dayName = getDayName(processDate);
        if (dayName === 'Sunday') continue;

        // Find teacher's LessonBlocks for this day
        const blockFilter = {
          timetable: activeTimetable._id,
          teacher,
          day: dayName,
          type: { $nin: ['reserved', 'free'] }
        };

        const blocks = await LessonBlock.find(blockFilter)
          .populate('subject classes');

        for (const block of blocks) {
          const blockPeriod = block.periods[0];

          // If selected_periods, only process matching periods
          if (absenceType === 'selected_periods' && affectedPeriods && affectedPeriods.length > 0) {
            if (!affectedPeriods.includes(blockPeriod)) continue;
          }

          const classId = block.classes[0]?._id || block.classes[0];
          const subjectId = block.subject?._id || block.subject;

          // 4. Search for available substitute teacher using Can Teach eligibility
          let substituteTeacher = null;
          let replacementStatus = 'unresolved';
          let scoredCandidates = [];

          // Try CanTeach mappings first (structured eligibility)
          const CanTeach = require('../models/CanTeach');
          const classDoc = block.classes[0];
          const eligibleMappings = await CanTeach.findEligible({
            schoolId: scope.school, sessionId: scope.session,
            subjectId, classId,
            stream: classDoc?.stream, section: classDoc?.section
          });

          // Score each eligible teacher
          for (const mapping of eligibleMappings) {
            const tid = mapping.teacher?._id;
            if (!tid || tid.toString() === teacher.toString()) continue;

            // Check if teacher is free this period
            const busy = await LessonBlock.findOne({
              timetable: activeTimetable._id, teacher: tid,
              day: dayName, periods: blockPeriod,
              type: { $nin: ['reserved', 'free'] }
            });
            if (busy) continue;

            // Check unavailable slots
            const unavail = mapping.teacher.unavailableSlots?.find(u => u.day === dayName);
            if (unavail && unavail.periods.includes(blockPeriod)) continue;

            // Count daily load
            const dailyCount = await LessonBlock.countDocuments({
              timetable: activeTimetable._id, teacher: tid, day: dayName,
              type: { $nin: ['reserved', 'free'] }
            });
            if (dailyCount >= (mapping.teacher.maxPeriodsPerDay || 6)) continue;

            const score = CanTeach.scoreForReplacement(mapping, dailyCount, mapping.teacher.maxPeriodsPerDay);
            scoredCandidates.push({ teacherId: tid, score, role: mapping.role, priority: mapping.priority, dailyCount });
          }

          // Fallback: if no CanTeach mappings, use basic capabilities
          if (scoredCandidates.length === 0) {
            const fallbackCandidates = await Teacher.find({
              school: scope.school, session: scope.session,
              status: 'active', _id: { $ne: teacher },
              'capabilities.subject': subjectId
            });

            for (const candidate of fallbackCandidates) {
              const busy = await LessonBlock.findOne({
                timetable: activeTimetable._id, teacher: candidate._id,
                day: dayName, periods: blockPeriod,
                type: { $nin: ['reserved', 'free'] }
              });
              if (busy) continue;

              const unavail = candidate.unavailableSlots?.find(u => u.day === dayName);
              if (unavail && unavail.periods.includes(blockPeriod)) continue;

              const dailyCount = await LessonBlock.countDocuments({
                timetable: activeTimetable._id, teacher: candidate._id, day: dayName,
                type: { $nin: ['reserved', 'free'] }
              });
              if (dailyCount >= (candidate.maxPeriodsPerDay || 6)) continue;

              const proficiency = candidate.capabilities.find(c => c.subject?.toString() === subjectId?.toString());
              const roleScore = proficiency?.proficiency === 'primary' ? 30 : proficiency?.proficiency === 'secondary' ? 20 : 10;
              const score = roleScore + Math.round((1 - dailyCount / (candidate.maxPeriodsPerDay || 6)) * 15);
              scoredCandidates.push({ teacherId: candidate._id, score, role: proficiency?.proficiency || 'fallback', priority: 5, dailyCount });
            }
          }

          // Sort by score descending and pick the best
          scoredCandidates.sort((a, b) => b.score - a.score);

          if (scoredCandidates.length > 0) {
            substituteTeacher = scoredCandidates[0].teacherId;

            await Substitution.create({
              school: scope.school,
              originalTeacher: teacher,
              substituteTeacher,
              class: classId,
              subject: subjectId,
              date: processDate,
              period: blockPeriod,
              status: 'confirmed',
              notes: `Auto-assigned (score: ${scoredCandidates[0].score}, role: ${scoredCandidates[0].role}) for absence on ${processDate.toISOString().split('T')[0]}`
            });

            replacementStatus = 'replaced';
          }

          allAffectedBlocks.push({
            lessonBlock: block._id,
            period: blockPeriod,
            day: dayName,
            class: classId,
            subject: subjectId,
            replacementStatus,
            substituteTeacher
          });
        }
      }
    }

    // 5. Update absence with affected blocks
    absence.affectedBlocks = allAffectedBlocks;
    absence.autoReplacementAttempted = true;

    // 6. Set status based on results
    if (allAffectedBlocks.length === 0) {
      absence.status = 'active';
    } else {
      const allReplaced = allAffectedBlocks.every(b => b.replacementStatus === 'replaced');
      const someReplaced = allAffectedBlocks.some(b => b.replacementStatus === 'replaced');
      if (allReplaced) {
        absence.status = 'resolved';
      } else if (someReplaced) {
        absence.status = 'partial';
      } else {
        absence.status = 'active';
      }
    }

    await absence.save();

    // 7. Create AuditLog
    await AuditLog.create({
      school: scope.school,
      session: scope.session,
      action: 'absence_create',
      entityType: 'absence',
      entityId: absence._id,
      source: 'manual',
      newValue: {
        teacher, date, absenceType,
        totalBlocks: allAffectedBlocks.length,
        replaced: allAffectedBlocks.filter(b => b.replacementStatus === 'replaced').length,
        unresolved: allAffectedBlocks.filter(b => b.replacementStatus === 'unresolved').length
      }
    });

    const populated = await Absence.findById(absence._id)
      .populate('teacher')
      .populate('affectedBlocks.class')
      .populate('affectedBlocks.subject')
      .populate('affectedBlocks.substituteTeacher');

    res.status(201).json({ success: true, data: populated });
  } catch (err) { next(err); }
};

/**
 * Get absences with filters
 */
exports.getAbsences = async (req, res, next) => {
  try {
    const scope = await getScope();
    const filter = { school: scope.school };

    if (req.query.teacher) filter.teacher = req.query.teacher;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.dateFrom || req.query.dateTo) {
      filter.date = {};
      if (req.query.dateFrom) filter.date.$gte = new Date(req.query.dateFrom);
      if (req.query.dateTo) filter.date.$lte = new Date(req.query.dateTo);
    }

    const absences = await Absence.find(filter)
      .populate('teacher')
      .populate('affectedBlocks.substituteTeacher')
      .sort({ date: -1 });

    res.json({ success: true, count: absences.length, data: absences });
  } catch (err) { next(err); }
};

/**
 * Get absence detail by ID
 */
exports.getAbsenceDetail = async (req, res, next) => {
  try {
    const absence = await Absence.findById(req.params.id)
      .populate('teacher')
      .populate('createdBy', 'name email')
      .populate('affectedBlocks.lessonBlock')
      .populate('affectedBlocks.class')
      .populate('affectedBlocks.subject')
      .populate('affectedBlocks.substituteTeacher');

    if (!absence) return res.status(404).json({ success: false, error: 'Absence not found' });
    res.json({ success: true, data: absence });
  } catch (err) { next(err); }
};

/**
 * Cancel an absence - reverts substitutions
 */
exports.cancelAbsence = async (req, res, next) => {
  try {
    const absence = await Absence.findById(req.params.id);
    if (!absence) return res.status(404).json({ success: false, error: 'Absence not found' });

    if (absence.status === 'cancelled') {
      return res.status(400).json({ success: false, error: 'Absence is already cancelled' });
    }

    // Revert all substitutions for this absence
    const datesToProcess = absence.absenceType === 'date_range' && absence.endDate
      ? getDateRange(absence.date, absence.endDate)
      : [absence.date];

    for (const processDate of datesToProcess) {
      await Substitution.updateMany(
        {
          school: absence.school,
          originalTeacher: absence.teacher,
          date: processDate,
          status: { $in: ['pending', 'confirmed'] }
        },
        { $set: { status: 'cancelled' } }
      );
    }

    absence.status = 'cancelled';
    absence.affectedBlocks.forEach(block => {
      if (block.replacementStatus === 'replaced') {
        block.replacementStatus = 'unresolved';
        block.substituteTeacher = undefined;
      }
    });
    await absence.save();

    await AuditLog.create({
      school: absence.school,
      action: 'update',
      entityType: 'absence',
      entityId: absence._id,
      source: 'manual',
      oldValue: { status: 'active' },
      newValue: { status: 'cancelled' }
    });

    const populated = await Absence.findById(absence._id).populate('teacher');
    res.json({ success: true, data: populated });
  } catch (err) { next(err); }
};

/**
 * Manually resolve a specific unresolved block
 */
exports.manualResolve = async (req, res, next) => {
  try {
    const { blockIndex, substituteTeacherId } = req.body;
    const absence = await Absence.findById(req.params.id);
    if (!absence) return res.status(404).json({ success: false, error: 'Absence not found' });

    if (blockIndex === undefined || blockIndex < 0 || blockIndex >= absence.affectedBlocks.length) {
      return res.status(400).json({ success: false, error: 'Invalid blockIndex' });
    }

    const block = absence.affectedBlocks[blockIndex];
    if (block.replacementStatus === 'replaced') {
      return res.status(400).json({ success: false, error: 'Block is already replaced' });
    }

    // Validate substitute teacher availability
    const substituteTeacher = await Teacher.findById(substituteTeacherId);
    if (!substituteTeacher) {
      return res.status(404).json({ success: false, error: 'Substitute teacher not found' });
    }

    // Check if substitute is free at that period on that day
    const activeTimetable = await GeneratedTimetable.findOne({
      school: absence.school,
      status: { $in: ['published', 'draft'] }
    }).sort({ createdAt: -1 });

    if (activeTimetable) {
      const busyBlock = await LessonBlock.findOne({
        timetable: activeTimetable._id,
        teacher: substituteTeacherId,
        day: block.day,
        periods: block.period,
        type: { $nin: ['reserved', 'free'] }
      });
      if (busyBlock) {
        return res.status(400).json({ success: false, error: 'Substitute teacher is busy at this period' });
      }
    }

    // Create Substitution record
    await Substitution.create({
      school: absence.school,
      originalTeacher: absence.teacher,
      substituteTeacher: substituteTeacherId,
      class: block.class,
      subject: block.subject,
      date: absence.date,
      period: block.period,
      status: 'confirmed',
      notes: 'Manually assigned substitute'
    });

    // Update block
    block.replacementStatus = 'manual';
    block.substituteTeacher = substituteTeacherId;

    // Recalculate absence status
    const allResolved = absence.affectedBlocks.every(b => b.replacementStatus !== 'unresolved');
    if (allResolved) {
      absence.status = 'resolved';
    } else {
      absence.status = 'partial';
    }

    await absence.save();

    const populated = await Absence.findById(absence._id)
      .populate('teacher')
      .populate('affectedBlocks.class')
      .populate('affectedBlocks.subject')
      .populate('affectedBlocks.substituteTeacher');

    res.json({ success: true, data: populated });
  } catch (err) { next(err); }
};

/**
 * Get all absences with unresolved periods
 */
exports.getUnresolvedPeriods = async (req, res, next) => {
  try {
    const scope = await getScope();
    const absences = await Absence.find({
      school: scope.school,
      status: { $in: ['active', 'partial'] },
      'affectedBlocks.replacementStatus': 'unresolved'
    })
      .populate('teacher')
      .populate('affectedBlocks.class')
      .populate('affectedBlocks.subject')
      .sort({ date: -1 });

    // Filter to only include unresolved blocks in response
    const result = absences.map(absence => {
      const unresolvedBlocks = absence.affectedBlocks.filter(b => b.replacementStatus === 'unresolved');
      return {
        _id: absence._id,
        teacher: absence.teacher,
        date: absence.date,
        absenceType: absence.absenceType,
        status: absence.status,
        unresolvedBlocks,
        totalBlocks: absence.affectedBlocks.length,
        unresolvedCount: unresolvedBlocks.length
      };
    });

    res.json({ success: true, count: result.length, data: result });
  } catch (err) { next(err); }
};
