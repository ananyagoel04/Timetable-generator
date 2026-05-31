const CanTeach = require('../models/CanTeach');
const Teacher = require('../models/Teacher');
const Subject = require('../models/Subject');
const Class = require('../models/Class');
const AcademicSession = require('../models/AcademicSession');
const AuditLog = require('../models/AuditLog');

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
 * List all Can Teach mappings with optional filters
 */
exports.list = async (req, res, next) => {
  try {
    const { schoolId, sessionId } = await getScope(req);
    const { teacherId, subjectId, eligibilityType, activeOnly } = req.query;
    
    const filter = { school: schoolId, session: sessionId };
    if (teacherId) filter.teacher = teacherId;
    if (subjectId) filter.subject = subjectId;
    if (eligibilityType) filter.eligibilityType = eligibilityType;
    if (activeOnly === 'true') filter.isActive = true;

    const mappings = await CanTeach.find(filter)
      .populate('teacher', 'name shortName department status capabilities')
      .populate('subject', 'name code color type')
      .populate('eligibleClasses', 'name grade section stream')
      .sort({ 'teacher.name': 1, eligibilityType: 1, priority: -1 });

    res.json({ success: true, count: mappings.length, data: mappings });
  } catch (err) { next(err); }
};

/**
 * Create a single Can Teach mapping
 */
exports.create = async (req, res, next) => {
  try {
    const { schoolId, sessionId } = await getScope(req);
    const data = {
      ...req.body,
      school: schoolId,
      session: sessionId
    };

    // Backward compat: accept 'role' as alias for 'eligibilityType'
    if (data.role && !data.eligibilityType) {
      data.eligibilityType = data.role === 'fallback' ? 'secondary' : data.role;
      delete data.role;
    }

    // Check for duplicate
    const existing = await CanTeach.findOne({
      school: schoolId, session: sessionId,
      teacher: data.teacher, subject: data.subject,
      eligibilityType: data.eligibilityType || 'primary'
    });
    if (existing) {
      return res.status(409).json({ success: false, error: 'Mapping already exists for this teacher-subject-eligibilityType combination' });
    }

    const mapping = await CanTeach.create(data);
    const populated = await CanTeach.findById(mapping._id)
      .populate('teacher', 'name shortName')
      .populate('subject', 'name code');

    await AuditLog.create({
      school: schoolId,
      action: 'create',
      entityType: 'can_teach',
      entityId: mapping._id,
      description: `Can Teach mapping created: ${populated.teacher?.name} → ${populated.subject?.name} (${data.eligibilityType || 'primary'})`,
      newData: data,
      source: 'admin'
    });

    res.status(201).json({ success: true, data: populated });
  } catch (err) { next(err); }
};

/**
 * Bulk create/update Can Teach mappings
 */
exports.bulkUpsert = async (req, res, next) => {
  try {
    const { schoolId, sessionId } = await getScope(req);
    const { mappings } = req.body;
    if (!Array.isArray(mappings) || mappings.length === 0) {
      return res.status(400).json({ success: false, error: 'mappings array required' });
    }

    let created = 0, updated = 0, skipped = 0;

    for (const m of mappings) {
      if (!m.teacher || !m.subject) { skipped++; continue; }

      // Backward compat
      if (m.role && !m.eligibilityType) {
        m.eligibilityType = m.role === 'fallback' ? 'secondary' : m.role;
        delete m.role;
      }

      const filter = {
        school: schoolId, session: sessionId,
        teacher: m.teacher, subject: m.subject
      };
      if (m.eligibilityType) filter.eligibilityType = m.eligibilityType;

      const update = {
        ...m,
        school: schoolId,
        session: sessionId,
        isActive: m.isActive !== false
      };

      const result = await CanTeach.findOneAndUpdate(filter, update, { upsert: true, new: true, setDefaultsOnInsert: true });
      if (result.createdAt.getTime() === result.updatedAt.getTime()) created++;
      else updated++;
    }

    await AuditLog.create({
      school: schoolId,
      action: 'bulk_update',
      entityType: 'can_teach',
      description: `Bulk Can Teach: ${created} created, ${updated} updated, ${skipped} skipped`,
      source: 'admin'
    });

    res.json({ success: true, created, updated, skipped });
  } catch (err) { next(err); }
};

/**
 * Update a specific mapping
 */
exports.update = async (req, res, next) => {
  try {
    // Backward compat
    if (req.body.role && !req.body.eligibilityType) {
      req.body.eligibilityType = req.body.role === 'fallback' ? 'secondary' : req.body.role;
      delete req.body.role;
    }

    const mapping = await CanTeach.findByIdAndUpdate(req.params.id, req.body, { new: true })
      .populate('teacher', 'name shortName')
      .populate('subject', 'name code');
    if (!mapping) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: mapping });
  } catch (err) { next(err); }
};

/**
 * Delete a mapping
 */
exports.remove = async (req, res, next) => {
  try {
    const mapping = await CanTeach.findByIdAndDelete(req.params.id);
    if (!mapping) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, message: 'Deleted' });
  } catch (err) { next(err); }
};

/**
 * Get all mappings for a specific teacher
 */
exports.getByTeacher = async (req, res, next) => {
  try {
    const { schoolId, sessionId } = await getScope(req);
    const mappings = await CanTeach.find({
      school: schoolId, session: sessionId,
      teacher: req.params.teacherId, isActive: true
    })
      .populate('subject', 'name code color type')
      .populate('eligibleClasses', 'name grade section stream')
      .sort({ eligibilityType: 1, priority: -1 });

    res.json({ success: true, count: mappings.length, data: mappings });
  } catch (err) { next(err); }
};

/**
 * Get all eligible teachers for a specific subject (with optional class/stream filter)
 */
exports.getBySubject = async (req, res, next) => {
  try {
    const { schoolId, sessionId } = await getScope(req);
    const { classId, stream, section, mode } = req.query;

    const mappings = await CanTeach.findEligible({
      schoolId, sessionId,
      subjectId: req.params.subjectId,
      classId, stream, section,
      mode: mode || 'normal'
    });

    res.json({ success: true, count: mappings.length, data: mappings });
  } catch (err) { next(err); }
};

/**
 * Find eligible replacement teachers for a specific slot
 * Returns scored list of candidates
 */
exports.findEligibleReplacements = async (req, res, next) => {
  try {
    const { schoolId, sessionId } = await getScope(req);
    const { subjectId, classId, day, period, excludeTeacherId } = req.query;

    if (!subjectId) return res.status(400).json({ success: false, error: 'subjectId required' });

    const LessonBlock = require('../models/LessonBlock');
    const GeneratedTimetable = require('../models/GeneratedTimetable');

    // Get class details for stream/section
    const classDoc = classId ? await Class.findById(classId) : null;

    // Find eligible teachers (mode=replacement includes all types)
    const mappings = await CanTeach.findEligible({
      schoolId, sessionId, subjectId,
      classId, stream: classDoc?.stream, section: classDoc?.section,
      mode: 'replacement'
    });

    // Get active timetable
    const tt = await GeneratedTimetable.findOne({
      school: schoolId, session: sessionId,
      status: { $in: ['published', 'draft'] }
    }).sort({ createdAt: -1 });

    const scored = [];

    for (const m of mappings) {
      const tid = m.teacher?._id?.toString();
      if (!tid || tid === excludeTeacherId) continue;

      let available = true;
      let currentDayLoad = 0;

      if (tt && day && period) {
        // Check if teacher is free
        const busy = await LessonBlock.findOne({
          timetable: tt._id, teacher: m.teacher._id,
          day, periods: parseInt(period),
          type: { $nin: ['reserved', 'free'] }
        });
        if (busy) available = false;

        // Check unavailable slots
        const unavail = m.teacher.unavailableSlots?.find(u => u.day === day);
        if (unavail && unavail.periods.includes(parseInt(period))) available = false;

        // Count day load
        currentDayLoad = await LessonBlock.countDocuments({
          timetable: tt._id, teacher: m.teacher._id, day,
          type: { $nin: ['reserved', 'free'] }
        });

        if (currentDayLoad >= (m.teacher.maxPeriodsPerDay || 6)) available = false;
      }

      const score = CanTeach.scoreForReplacement(m, currentDayLoad, m.teacher.maxPeriodsPerDay);

      scored.push({
        teacher: {
          _id: m.teacher._id,
          name: m.teacher.name,
          shortName: m.teacher.shortName,
          department: m.teacher.department
        },
        eligibilityType: m.eligibilityType,
        priority: m.priority,
        score,
        available,
        currentDayLoad,
        maxPerDay: m.teacher.maxPeriodsPerDay || 6
      });
    }

    // Sort: available first, then by score desc
    scored.sort((a, b) => {
      if (a.available !== b.available) return a.available ? -1 : 1;
      return b.score - a.score;
    });

    res.json({ success: true, count: scored.length, data: scored });
  } catch (err) { next(err); }
};

/**
 * Sync from existing teacher capabilities array to CanTeach mappings
 */
exports.syncFromCapabilities = async (req, res, next) => {
  try {
    const { schoolId, sessionId } = await getScope(req);
    const teachers = await Teacher.find({ school: schoolId, session: sessionId });

    let created = 0, existing = 0;

    for (const teacher of teachers) {
      if (!teacher.capabilities || teacher.capabilities.length === 0) continue;

      for (const cap of teacher.capabilities) {
        const exists = await CanTeach.findOne({
          school: schoolId, session: sessionId,
          teacher: teacher._id, subject: cap.subject
        });

        if (exists) { existing++; continue; }

        await CanTeach.create({
          school: schoolId, session: sessionId,
          teacher: teacher._id,
          subject: cap.subject,
          eligibilityType: cap.proficiency === 'primary' ? 'primary' : cap.proficiency === 'secondary' ? 'secondary' : 'secondary',
          priority: cap.proficiency === 'primary' ? 8 : cap.proficiency === 'secondary' ? 5 : 3,
          eligibleClasses: [],
          eligibleStreams: [],
          eligibleSections: [],
          isActive: true
        });
        created++;
      }
    }

    await AuditLog.create({
      school: schoolId,
      action: 'sync',
      entityType: 'can_teach',
      description: `Synced from capabilities: ${created} created, ${existing} already existed`,
      source: 'admin'
    });

    res.json({ success: true, created, existing, total: created + existing });
  } catch (err) { next(err); }
};

/**
 * Get summary matrix: teachers × subjects with eligibility data
 */
exports.matrix = async (req, res, next) => {
  try {
    const { schoolId, sessionId } = await getScope(req);
    const [teachers, subjects, mappings] = await Promise.all([
      Teacher.find({ school: schoolId, session: sessionId, status: 'active' }).select('name shortName department').sort({ name: 1 }),
      Subject.find({ school: schoolId, session: sessionId, isActive: true }).select('name code color type').sort({ name: 1 }),
      CanTeach.find({ school: schoolId, session: sessionId, isActive: true }).select('teacher subject eligibilityType priority')
    ]);

    // Build lookup
    const matrixMap = {};
    mappings.forEach(m => {
      const key = `${m.teacher}_${m.subject}`;
      if (!matrixMap[key] || m.eligibilityType === 'primary') {
        matrixMap[key] = { eligibilityType: m.eligibilityType, priority: m.priority };
      }
    });

    res.json({
      success: true,
      data: {
        teachers: teachers.map(t => ({ _id: t._id, name: t.name, shortName: t.shortName, department: t.department })),
        subjects: subjects.map(s => ({ _id: s._id, name: s.name, code: s.code, color: s.color, type: s.type })),
        matrix: matrixMap,
        totalMappings: mappings.length
      }
    });
  } catch (err) { next(err); }
};
