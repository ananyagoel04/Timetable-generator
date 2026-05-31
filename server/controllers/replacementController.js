const LessonBlock = require('../models/LessonBlock');
const Teacher = require('../models/Teacher');
const SubjectRequirement = require('../models/SubjectRequirement');
const GeneratedTimetable = require('../models/GeneratedTimetable');
const ConflictLog = require('../models/ConflictLog');
const Substitution = require('../models/Substitution');
const AuditLog = require('../models/AuditLog');
const CanTeach = require('../models/CanTeach');
const School = require('../models/School');
const AcademicSession = require('../models/AcademicSession');
const { createNotification } = require('./notificationController');
const { withTransaction } = require('../services/transactionHelper');
const { createAuditEntry } = require('../services/auditHelper');

const getScope = async (req) => {
  const schoolId = req.schoolId;
  const sessionId = req.sessionId;
  if (!sessionId && schoolId) {
    const s = await AcademicSession.findOne({ school: schoolId, isCurrent: true });
    return { schoolId, sessionId: s?._id };
  }
  return { schoolId, sessionId };
};

/**
 * POST /api/teachers/:id/replace/preview
 * Dry-run: show what would change without applying
 */
exports.previewReplacement = async (req, res, next) => {
  try {
    const { assignmentIds, newTeacherId, type } = req.body;
    const oldTeacherId = req.params.id;

    const oldTeacher = await Teacher.findById(oldTeacherId);
    const newTeacher = await Teacher.findById(newTeacherId);
    if (!oldTeacher || !newTeacher) return res.status(404).json({ success: false, error: 'Teacher not found' });

    const { schoolId, sessionId } = await getScope(req);

    // Get assignments being transferred
    const requirements = await SubjectRequirement.find({
      _id: { $in: assignmentIds }, teacher: oldTeacherId
    }).populate('subject class');

    // Analyse new teacher's current workload
    const newTeacherReqs = await SubjectRequirement.find({
      school: schoolId, session: sessionId, teacher: newTeacherId
    }).populate('subject class');
    const currentLoad = newTeacherReqs.reduce((s, r) => s + r.periodsPerWeek, 0);
    const addedLoad = requirements.reduce((s, r) => s + r.periodsPerWeek, 0);

    // Get active timetable to preview block changes
    const tt = await GeneratedTimetable.findOne({
      school: schoolId, status: { $in: ['draft', 'published'] }
    }).sort({ createdAt: -1 });

    let affectedBlocks = [];
    let potentialConflicts = 0;

    if (tt) {
      // Find lesson blocks that reference the old teacher + the subjects/classes being transferred
      const subjectIds = requirements.map(r => r.subject?._id || r.subject);
      const classIds = requirements.map(r => r.class?._id || r.class);

      affectedBlocks = await LessonBlock.find({
        timetable: tt._id,
        teacher: oldTeacherId,
        subject: { $in: subjectIds },
        classes: { $in: classIds },
        type: { $nin: ['reserved', 'free'] }
      }).populate('subject classes').lean();

      // Check for conflicts at each block's slot for the new teacher
      for (const block of affectedBlocks) {
        for (const p of block.periods) {
          const busy = await LessonBlock.findOne({
            timetable: tt._id,
            teacher: newTeacherId,
            day: block.day,
            periods: p,
            _id: { $ne: block._id },
            type: { $nin: ['reserved', 'free'] }
          });
          if (busy) potentialConflicts++;
        }
      }
    }

    // Check capability match
    const canTeachRecords = await CanTeach.find({
      teacher: newTeacherId, isActive: true
    });
    const capableSubjects = new Set(canTeachRecords.map(ct => ct.subject.toString()));
    const legacyCaps = new Set((newTeacher.capabilities || []).map(c => (c.subject?._id || c.subject)?.toString()));

    const subjectMatch = requirements.map(r => {
      const sid = (r.subject?._id || r.subject).toString();
      return {
        subject: r.subject?.name || sid,
        class: r.class?.name || '?',
        periodsPerWeek: r.periodsPerWeek,
        hasCapability: capableSubjects.has(sid) || legacyCaps.has(sid)
      };
    });

    res.json({
      success: true,
      data: {
        oldTeacher: { _id: oldTeacher._id, name: oldTeacher.name },
        newTeacher: { _id: newTeacher._id, name: newTeacher.name },
        assignments: subjectMatch,
        workloadBefore: currentLoad,
        workloadAfter: currentLoad + addedLoad,
        maxPeriodsPerDay: newTeacher.maxPeriodsPerDay || 6,
        affectedBlocks: affectedBlocks.length,
        potentialConflicts,
        overloaded: (currentLoad + addedLoad) > 40, // typical weekly max
        allCapable: subjectMatch.every(s => s.hasCapability)
      }
    });
  } catch (err) { next(err); }
};

/**
 * POST /api/teachers/:id/replace
 * Apply teacher replacement — updates requirements, timetable blocks, creates audit + notifications
 */
exports.applyReplacement = async (req, res, next) => {
  try {
    const { assignmentIds, newTeacherId, type, effectiveDate, reason } = req.body;
    const oldTeacherId = req.params.id;

    const oldTeacher = await Teacher.findById(oldTeacherId);
    const newTeacher = await Teacher.findById(newTeacherId);
    if (!oldTeacher || !newTeacher) return res.status(404).json({ success: false, error: 'Teacher not found' });

    const { schoolId, sessionId } = await getScope(req);

    const results = await withTransaction(async (session) => {
      const opts = session ? { session } : {};
      const out = { requirementsUpdated: 0, blocksUpdated: 0, conflictsCreated: 0, substitutionsCreated: 0 };

      // 1. Update SubjectRequirement records
      const requirements = await SubjectRequirement.find({
        _id: { $in: assignmentIds }, teacher: oldTeacherId
      }).populate('subject class').session(session);

      for (const req_ of requirements) {
        req_.teacher = newTeacherId;
        await req_.save(opts);
        out.requirementsUpdated++;
      }

      // 2. Update LessonBlock records in active timetable
      const tt = await GeneratedTimetable.findOne({
        school: schoolId, status: { $in: ['draft', 'published'] }
      }).sort({ createdAt: -1 }).session(session);

      if (tt) {
        const subjectIds = requirements.map(r => r.subject?._id || r.subject);
        const classIds = requirements.map(r => r.class?._id || r.class);

        const blocks = await LessonBlock.find({
          timetable: tt._id, teacher: oldTeacherId,
          subject: { $in: subjectIds }, classes: { $in: classIds },
          type: { $nin: ['reserved', 'free'] }
        }).session(session);

        for (const block of blocks) {
          const before = { teacher: oldTeacherId };

          // Check if new teacher is free at this slot
          const busy = await LessonBlock.findOne({
            timetable: tt._id, teacher: newTeacherId, day: block.day,
            periods: { $in: block.periods }, _id: { $ne: block._id },
            type: { $nin: ['reserved', 'free'] }
          }).session(session);

          if (busy) {
            await ConflictLog.create([{
              timetable: tt._id, type: 'teacher_clash', severity: 'high',
              day: block.day, period: block.periods[0],
              teacher: newTeacherId, classes: block.classes, subject: block.subject,
              blocks: [block._id, busy._id],
              title: 'Replacement Conflict',
              message: `${newTeacher.name} is already busy on ${block.day} Period ${block.periods[0]} after replacing ${oldTeacher.name}`,
              suggestedFix: 'Move one block to a different period',
              groupId: `replacement_${oldTeacherId}_${newTeacherId}`,
              autoResolvable: false
            }], opts);
            out.conflictsCreated++;
          }

          block.teacher = newTeacherId;
          block.isManualOverride = true;
          block.editHistory.push({
            action: 'teacher_replacement', before,
            after: { teacher: newTeacherId },
            userId: req.user?._id,
            reason: reason || `Replaced ${oldTeacher.name} with ${newTeacher.name}`,
            timestamp: new Date()
          });
          await block.save(opts);
          out.blocksUpdated++;
        }

        // 3. Create substitution records if temporary
        if (type === 'temporary') {
          for (const req_ of requirements) {
            await Substitution.create([{
              school: schoolId,
              originalTeacher: oldTeacherId,
              substituteTeacher: newTeacherId,
              class: req_.class?._id || req_.class,
              subject: req_.subject?._id || req_.subject,
              date: new Date(effectiveDate || Date.now()),
              period: 0,
              status: 'confirmed',
              notes: `Temporary replacement: ${oldTeacher.name} \u2192 ${newTeacher.name}`
            }], opts);
            out.substitutionsCreated++;
          }
        }
      }

      // 4. Audit log inside transaction
      await createAuditEntry({
        req, session,
        action: 'teacher_replacement',
        entityType: 'replacement',
        entityId: oldTeacherId,
        entityName: `${oldTeacher.name} \u2192 ${newTeacher.name}`,
        oldValue: { teacher: oldTeacherId, teacherName: oldTeacher.name, assignments: assignmentIds.length },
        newValue: { teacher: newTeacherId, teacherName: newTeacher.name, type, effectiveDate },
        reason: reason || `Teacher replacement: ${type}`
      });

      return out;
    });

    // 5. Notifications (outside transaction — non-critical)
    if (createNotification) {
      await createNotification({
        school: schoolId, session: sessionId,
        user: req.user?._id, type: 'teacher_replacement',
        title: 'Teacher Replacement Applied',
        message: `${oldTeacher.name} replaced by ${newTeacher.name} for ${results.requirementsUpdated} assignment(s). ${results.conflictsCreated} conflict(s) detected.`,
        severity: results.conflictsCreated > 0 ? 'warning' : 'info',
        actionUrl: '/replacements'
      });
    }

    res.json({ success: true, data: results });
  } catch (err) { next(err); }
};

/**
 * GET /api/teachers/:id/workload
 * Get teacher workload analysis
 */
exports.getWorkload = async (req, res, next) => {
  try {
    const teacherId = req.params.id;
    const { schoolId, sessionId } = await getScope(req);

    const teacher = await Teacher.findById(teacherId);
    if (!teacher) return res.status(404).json({ success: false, error: 'Teacher not found' });

    // Requirement-based load
    const requirements = await SubjectRequirement.find({
      school: schoolId, session: sessionId, teacher: teacherId
    }).populate('subject class');

    const totalPeriodsPerWeek = requirements.reduce((s, r) => s + r.periodsPerWeek, 0);

    // Timetable-based load
    const tt = await GeneratedTimetable.findOne({
      school: schoolId, status: { $in: ['draft', 'published'] }
    }).sort({ createdAt: -1 });

    let dailyLoad = {};
    let freePeriods = {};

    if (tt) {
      const blocks = await LessonBlock.find({
        timetable: tt._id, teacher: teacherId,
        type: { $nin: ['reserved', 'free'] }
      }).populate('subject classes');

      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      for (const day of days) {
        const dayBlocks = blocks.filter(b => b.day === day);
        dailyLoad[day] = dayBlocks.length;

        // Find free periods (assume 8 periods/day)
        const usedPeriods = new Set();
        for (const b of dayBlocks) {
          for (const p of b.periods) usedPeriods.add(p);
        }
        freePeriods[day] = [];
        for (let p = 1; p <= 8; p++) {
          if (!usedPeriods.has(p)) freePeriods[day].push(p);
        }
      }
    }

    // CanTeach capabilities
    const canTeachRecords = await CanTeach.find({
      teacher: teacherId, isActive: true
    }).populate('subject class');

    res.json({
      success: true,
      data: {
        teacher: { _id: teacher._id, name: teacher.name, department: teacher.department },
        totalPeriodsPerWeek,
        maxPeriodsPerDay: teacher.maxPeriodsPerDay || 6,
        assignments: requirements.map(r => ({
          subject: r.subject?.name,
          class: r.class?.name,
          periodsPerWeek: r.periodsPerWeek
        })),
        dailyLoad,
        freePeriods,
        capabilities: canTeachRecords.length,
        overloaded: totalPeriodsPerWeek > 35
      }
    });
  } catch (err) { next(err); }
};
