const SubjectRequirement = require('../models/SubjectRequirement');
const ClassSubjectMapping = require('../models/ClassSubjectMapping');
const Teacher = require('../models/Teacher');
const Class = require('../models/Class');
const Subject = require('../models/Subject');
const PeriodStructure = require('../models/PeriodStructure');
const AcademicSession = require('../models/AcademicSession');

/**
 * Scoping helper — uses middleware-injected schoolId/sessionId.
 * Falls back to finding current session if sessionId not provided.
 */
const getScope = async (req) => {
  const schoolId = req.schoolId;
  const sessionId = req.sessionId;
  if (!sessionId && schoolId) {
    const s = await AcademicSession.findOne({ school: schoolId, isCurrent: true });
    return { school: schoolId, session: s?._id };
  }
  return { school: schoolId, session: sessionId };
};

// ═══════════════════════════════════════════════════════════════════
// SUBJECT REQUIREMENTS (teacher assignment / periods per week)
// ═══════════════════════════════════════════════════════════════════

/**
 * GET /api/requirements - Get all requirements with full population
 */
exports.getAll = async (req, res, next) => {
  try {
    const scope = await getScope(req);
    const filter = { school: scope.school, session: scope.session };
    if (req.query.class) filter.class = req.query.class;
    if (req.query.subject) filter.subject = req.query.subject;
    if (req.query.teacher) filter.teacher = req.query.teacher;
    if (req.query.stream) filter.studentGroup = req.query.stream;

    const reqs = await SubjectRequirement.find(filter)
      .populate('class', 'name grade section stream')
      .populate('subject', 'name code color shortName type canBeDoubled defaultPeriodsPerWeek')
      .populate('teacher', 'name shortName email department maxPeriodsPerDay maxPeriodsPerWeek')
      .populate('preferredRoom', 'name roomNumber')
      .sort({ 'class': 1, 'subject': 1 });

    res.json({ success: true, count: reqs.length, data: reqs });
  } catch (err) { next(err); }
};

/**
 * POST /api/requirements - Create single requirement
 */
exports.create = async (req, res, next) => {
  try {
    const scope = await getScope(req);
    const req_data = { ...req.body, school: scope.school, session: scope.session };
    const existing = await SubjectRequirement.findOne({
      school: scope.school, session: scope.session,
      class: req_data.class, subject: req_data.subject,
      studentGroup: req_data.studentGroup || null
    });
    if (existing) {
      Object.assign(existing, req_data);
      await existing.save();
      const populated = await SubjectRequirement.findById(existing._id)
        .populate('class subject teacher preferredRoom');
      return res.json({ success: true, data: populated });
    }
    const created = await SubjectRequirement.create(req_data);
    const populated = await SubjectRequirement.findById(created._id)
      .populate('class subject teacher preferredRoom');
    res.status(201).json({ success: true, data: populated });
  } catch (err) { next(err); }
};

/**
 * PUT /api/requirements/:id - Update single requirement
 */
exports.update = async (req, res, next) => {
  try {
    const updated = await SubjectRequirement.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
      .populate('class subject teacher preferredRoom');
    if (!updated) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
};

/**
 * DELETE /api/requirements/:id
 */
exports.remove = async (req, res, next) => {
  try {
    await SubjectRequirement.findByIdAndDelete(req.params.id);
    res.json({ success: true, data: {} });
  } catch (err) { next(err); }
};

/**
 * POST /api/requirements/bulk - Bulk create/update requirements
 * Body: { requirements: [{ class, subject, teacher, periodsPerWeek, ... }] }
 */
exports.bulkSave = async (req, res, next) => {
  try {
    const scope = await getScope(req);
    const { requirements } = req.body;
    if (!requirements || !Array.isArray(requirements)) {
      return res.status(400).json({ success: false, error: 'requirements array is required' });
    }

    const results = [];
    for (const item of requirements) {
      const filter = {
        school: scope.school, session: scope.session,
        class: item.class, subject: item.subject,
        studentGroup: item.studentGroup || null
      };

      const updateData = {
        ...item,
        school: scope.school,
        session: scope.session
      };

      const result = await SubjectRequirement.findOneAndUpdate(
        filter, updateData,
        { new: true, upsert: true, runValidators: true }
      );
      results.push(result);
    }

    res.json({ success: true, count: results.length, data: results });
  } catch (err) { next(err); }
};

/**
 * POST /api/requirements/clone - Clone requirements from source class to target classes
 * Body: { sourceClass, targetClasses: [classId1, classId2, ...] }
 */
exports.clone = async (req, res, next) => {
  try {
    const scope = await getScope(req);
    const { sourceClass, targetClasses } = req.body;

    if (!sourceClass || !targetClasses || !targetClasses.length) {
      return res.status(400).json({ success: false, error: 'sourceClass and targetClasses are required' });
    }

    const sourceReqs = await SubjectRequirement.find({
      school: scope.school, session: scope.session, class: sourceClass
    });

    if (!sourceReqs.length) {
      return res.status(404).json({ success: false, error: 'No requirements found for source class' });
    }

    let clonedCount = 0;
    for (const targetClass of targetClasses) {
      for (const src of sourceReqs) {
        await SubjectRequirement.findOneAndUpdate(
          {
            school: scope.school, session: scope.session,
            class: targetClass, subject: src.subject,
            studentGroup: src.studentGroup || null
          },
          {
            school: scope.school, session: scope.session,
            class: targetClass, subject: src.subject,
            teacher: src.teacher,
            periodsPerWeek: src.periodsPerWeek,
            preferredRoom: src.preferredRoom,
            studentGroup: src.studentGroup,
            allowDoublePeriod: src.allowDoublePeriod,
            doublePeriodsPerWeek: src.doublePeriodsPerWeek,
            consecutivePreference: src.consecutivePreference,
            consecutiveCount: src.consecutiveCount,
            preferredDays: src.preferredDays,
            avoidDays: src.avoidDays,
            isActive: true
          },
          { upsert: true, new: true }
        );
        clonedCount++;
      }
    }

    res.json({
      success: true,
      message: `Cloned ${sourceReqs.length} requirements to ${targetClasses.length} classes`,
      clonedCount
    });
  } catch (err) { next(err); }
};

/**
 * GET /api/requirements/workload-summary - Teacher workload across all classes
 */
exports.workloadSummary = async (req, res, next) => {
  try {
    const scope = await getScope(req);

    const teachers = await Teacher.find({ school: scope.school, session: scope.session, status: 'active' })
      .select('name shortName department maxPeriodsPerDay maxPeriodsPerWeek');

    const reqs = await SubjectRequirement.find({ school: scope.school, session: scope.session, isActive: true })
      .populate('class', 'name')
      .populate('subject', 'name code');

    const summary = teachers.map(t => {
      const teacherReqs = reqs.filter(r => r.teacher?.toString() === t._id.toString());
      const totalPeriods = teacherReqs.reduce((sum, r) => sum + (r.periodsPerWeek || 0), 0);
      const classBreakdown = {};
      teacherReqs.forEach(r => {
        const className = r.class?.name || 'Unknown';
        if (!classBreakdown[className]) classBreakdown[className] = 0;
        classBreakdown[className] += r.periodsPerWeek || 0;
      });

      return {
        teacher: { _id: t._id, name: t.name, shortName: t.shortName, department: t.department },
        totalPeriods,
        maxPeriodsPerWeek: t.maxPeriodsPerWeek || 30,
        utilizationPercent: Math.round((totalPeriods / (t.maxPeriodsPerWeek || 30)) * 100),
        status: totalPeriods > (t.maxPeriodsPerWeek || 30) ? 'overloaded' : totalPeriods > (t.maxPeriodsPerWeek || 30) * 0.85 ? 'warning' : 'ok',
        classCount: Object.keys(classBreakdown).length,
        classBreakdown,
        subjectCount: teacherReqs.length
      };
    });

    summary.sort((a, b) => b.utilizationPercent - a.utilizationPercent);
    res.json({ success: true, data: summary });
  } catch (err) { next(err); }
};

/**
 * GET /api/requirements/balancing - Intelligent balancing suggestions
 */
exports.balancingSuggestions = async (req, res, next) => {
  try {
    const scope = await getScope(req);
    const reqs = await SubjectRequirement.find({ school: scope.school, session: scope.session, isActive: true })
      .populate('class', 'name')
      .populate('subject', 'name code')
      .populate('teacher', 'name maxPeriodsPerWeek capabilities');

    const teachers = await Teacher.find({ school: scope.school, session: scope.session, status: 'active' })
      .populate('capabilities.subject', 'name');

    // Build workload map
    const workloadMap = {};
    teachers.forEach(t => { workloadMap[t._id.toString()] = { teacher: t, totalPeriods: 0, reqs: [] }; });
    reqs.forEach(r => {
      const tid = r.teacher?._id?.toString();
      if (tid && workloadMap[tid]) {
        workloadMap[tid].totalPeriods += r.periodsPerWeek || 0;
        workloadMap[tid].reqs.push(r);
      }
    });

    const suggestions = [];

    // Find overloaded teachers
    Object.values(workloadMap).forEach(entry => {
      const max = entry.teacher.maxPeriodsPerWeek || 30;
      if (entry.totalPeriods > max) {
        const excessPeriods = entry.totalPeriods - max;
        const candidates = [];

        entry.reqs.forEach(r => {
          const subjectId = r.subject?._id?.toString();
          Object.values(workloadMap).forEach(other => {
            if (other.teacher._id.toString() === entry.teacher._id.toString()) return;
            const canTeach = other.teacher.capabilities?.some(c =>
              (c.subject?._id || c.subject)?.toString() === subjectId
            );
            if (canTeach && other.totalPeriods < (other.teacher.maxPeriodsPerWeek || 30) * 0.8) {
              candidates.push({
                fromTeacher: { _id: entry.teacher._id, name: entry.teacher.name },
                toTeacher: { _id: other.teacher._id, name: other.teacher.name },
                subject: r.subject?.name,
                class: r.class?.name,
                periods: r.periodsPerWeek,
                reason: `${entry.teacher.name} is overloaded (${entry.totalPeriods}/${max}). ${other.teacher.name} has capacity (${other.totalPeriods}/${other.teacher.maxPeriodsPerWeek || 30}).`
              });
            }
          });
        });

        if (candidates.length > 0) {
          suggestions.push({
            type: 'overload',
            severity: 'warning',
            teacher: entry.teacher.name,
            currentLoad: entry.totalPeriods,
            maxLoad: max,
            excessPeriods,
            candidates: candidates.slice(0, 3)
          });
        }
      }
    });

    // Find unassigned core subjects
    const classes = await Class.find({ school: scope.school, session: scope.session, isActive: true });
    const subjects = await Subject.find({ school: scope.school, session: scope.session, isActive: true });

    // Check ClassSubjectMapping for applicable subjects
    const mappings = await ClassSubjectMapping.find({ school: scope.school, session: scope.session, isActive: true });
    const mappingSet = new Set(mappings.map(m => `${m.class}_${m.subject}`));

    classes.forEach(cls => {
      subjects.forEach(sub => {
        const key = `${cls._id}_${sub._id}`;
        // Only flag if subject IS mapped to this class but has no requirement
        if (mappingSet.has(key)) {
          const hasReq = reqs.some(r =>
            r.class?._id?.toString() === cls._id.toString() &&
            r.subject?._id?.toString() === sub._id.toString()
          );
          if (!hasReq) {
            suggestions.push({
              type: 'unassigned',
              severity: 'info',
              message: `${sub.name} is mapped to ${cls.name} but has no teacher assigned`,
              class: cls.name,
              subject: sub.name
            });
          }
        }
      });
    });

    res.json({ success: true, count: suggestions.length, data: suggestions });
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════════════
// CLASS-SUBJECT MAPPINGS (which subjects are taught in which class)
// ═══════════════════════════════════════════════════════════════════

/**
 * GET /api/requirements/class-subjects - List all class-subject mappings
 */
exports.listClassSubjects = async (req, res, next) => {
  try {
    const scope = await getScope(req);
    const filter = { school: scope.school, session: scope.session };
    if (req.query.class) filter.class = req.query.class;
    if (req.query.subject) filter.subject = req.query.subject;
    if (req.query.activeOnly === 'true') filter.isActive = true;

    const mappings = await ClassSubjectMapping.find(filter)
      .populate('class', 'name grade section stream')
      .populate('subject', 'name code color type category defaultPeriodsPerWeek canBeDoubled')
      .sort({ 'class': 1, 'subject': 1 });

    res.json({ success: true, count: mappings.length, data: mappings });
  } catch (err) { next(err); }
};

/**
 * GET /api/requirements/classes/:classId/subjects - Subjects for a specific class
 */
exports.getClassSubjects = async (req, res, next) => {
  try {
    const scope = await getScope(req);
    const mappings = await ClassSubjectMapping.find({
      school: scope.school, session: scope.session,
      class: req.params.classId, isActive: true
    })
      .populate('subject', 'name code color type category defaultPeriodsPerWeek canBeDoubled')
      .sort({ 'subject.name': 1 });

    res.json({ success: true, count: mappings.length, data: mappings });
  } catch (err) { next(err); }
};

/**
 * POST /api/requirements/class-subjects - Create single mapping
 */
exports.createClassSubject = async (req, res, next) => {
  try {
    const scope = await getScope(req);
    const data = { ...req.body, school: scope.school, session: scope.session };

    const existing = await ClassSubjectMapping.findOne({
      school: scope.school, session: scope.session,
      class: data.class, subject: data.subject
    });

    if (existing) {
      Object.assign(existing, data);
      await existing.save();
      const populated = await ClassSubjectMapping.findById(existing._id)
        .populate('class', 'name grade section stream')
        .populate('subject', 'name code color type');
      return res.json({ success: true, data: populated, updated: true });
    }

    const created = await ClassSubjectMapping.create(data);
    const populated = await ClassSubjectMapping.findById(created._id)
      .populate('class', 'name grade section stream')
      .populate('subject', 'name code color type');
    res.status(201).json({ success: true, data: populated });
  } catch (err) { next(err); }
};

/**
 * PUT /api/requirements/class-subjects/:id - Update mapping
 */
exports.updateClassSubject = async (req, res, next) => {
  try {
    const updated = await ClassSubjectMapping.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
      .populate('class', 'name grade section stream')
      .populate('subject', 'name code color type');
    if (!updated) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
};

/**
 * DELETE /api/requirements/class-subjects/:id
 */
exports.deleteClassSubject = async (req, res, next) => {
  try {
    await ClassSubjectMapping.findByIdAndDelete(req.params.id);
    res.json({ success: true, data: {} });
  } catch (err) { next(err); }
};

/**
 * POST /api/requirements/class-subjects/bulk - Bulk upsert class-subject mappings
 * Body: { mappings: [{ class, subject, periodsPerWeek, ... }] }
 */
exports.bulkClassSubjects = async (req, res, next) => {
  try {
    const scope = await getScope(req);
    const { mappings } = req.body;
    if (!Array.isArray(mappings) || mappings.length === 0) {
      return res.status(400).json({ success: false, error: 'mappings array required' });
    }

    let created = 0, updated = 0, skipped = 0;

    for (const m of mappings) {
      if (!m.class || !m.subject) { skipped++; continue; }

      const filter = {
        school: scope.school, session: scope.session,
        class: m.class, subject: m.subject
      };

      const updateData = {
        ...m,
        school: scope.school,
        session: scope.session,
        isActive: m.isActive !== false
      };

      const result = await ClassSubjectMapping.findOneAndUpdate(filter, updateData, {
        upsert: true, new: true, setDefaultsOnInsert: true
      });
      if (result.createdAt.getTime() === result.updatedAt.getTime()) created++;
      else updated++;
    }

    res.json({ success: true, created, updated, skipped });
  } catch (err) { next(err); }
};

/**
 * POST /api/requirements/class-subjects/generate - Auto-generate mappings from existing SubjectRequirements
 * Creates ClassSubjectMapping for every class+subject combo found in SubjectRequirements
 */
exports.generateClassSubjects = async (req, res, next) => {
  try {
    const scope = await getScope(req);
    const reqs = await SubjectRequirement.find({ school: scope.school, session: scope.session, isActive: true });

    let created = 0, existing = 0;

    for (const r of reqs) {
      const exists = await ClassSubjectMapping.findOne({
        school: scope.school, session: scope.session,
        class: r.class, subject: r.subject
      });

      if (exists) { existing++; continue; }

      await ClassSubjectMapping.create({
        school: scope.school, session: scope.session,
        class: r.class, subject: r.subject,
        isActive: true,
        periodsPerWeek: r.periodsPerWeek || 0,
        allowDoublePeriod: r.allowDoublePeriod || false,
        requiresLab: r.requiresLab || false
      });
      created++;
    }

    res.json({ success: true, created, existing, total: created + existing });
  } catch (err) { next(err); }
};

/**
 * GET /api/requirements/validation - Readiness checks for timetable generation
 */
exports.validation = async (req, res, next) => {
  try {
    const scope = await getScope(req);
    const CanTeach = require('../models/CanTeach');
    const issues = [];

    // Load data
    const [classes, subjects, teachers, reqs, canTeachMappings, classSubjects] = await Promise.all([
      Class.find({ school: scope.school, session: scope.session, isActive: true }),
      Subject.find({ school: scope.school, session: scope.session, isActive: true }),
      Teacher.find({ school: scope.school, session: scope.session, status: 'active' }),
      SubjectRequirement.find({ school: scope.school, session: scope.session, isActive: true })
        .populate('teacher', 'name')
        .populate('class', 'name grade section stream')
        .populate('subject', 'name code'),
      CanTeach.find({ school: scope.school, session: scope.session, isActive: true }),
      ClassSubjectMapping.find({ school: scope.school, session: scope.session, isActive: true })
    ]);

    // 1. Classes without any subject mappings
    for (const cls of classes) {
      const hasMappings = classSubjects.some(m => m.class.toString() === cls._id.toString());
      if (!hasMappings) {
        issues.push({
          type: 'no_subjects',
          severity: 'error',
          message: `${cls.name} has no subject mappings`,
          classId: cls._id, className: cls.name
        });
      }
    }

    // 2. Requirements without teacher assignment
    for (const r of reqs) {
      if (!r.teacher) {
        issues.push({
          type: 'no_teacher',
          severity: 'error',
          message: `${r.subject?.name} for ${r.class?.name} has no teacher assigned`,
          classId: r.class?._id, subjectId: r.subject?._id
        });
      }
    }

    // 3. Teacher assigned in requirement but NOT eligible via CanTeach
    for (const r of reqs) {
      if (!r.teacher) continue;
      const eligible = canTeachMappings.some(ct =>
        ct.teacher.toString() === r.teacher._id.toString() &&
        ct.subject.toString() === r.subject._id.toString() &&
        (ct.eligibleClasses.length === 0 || ct.eligibleClasses.some(c => c.toString() === r.class._id.toString()))
      );
      if (!eligible) {
        issues.push({
          type: 'ineligible_teacher',
          severity: 'warning',
          message: `${r.teacher?.name} is assigned to teach ${r.subject?.name} for ${r.class?.name} but has no CanTeach mapping`,
          classId: r.class?._id, subjectId: r.subject?._id, teacherId: r.teacher?._id
        });
      }
    }

    // 4. Overloaded teachers
    const teacherLoads = {};
    reqs.forEach(r => {
      if (!r.teacher) return;
      const tid = r.teacher._id.toString();
      teacherLoads[tid] = (teacherLoads[tid] || 0) + (r.periodsPerWeek || 0);
    });
    for (const t of teachers) {
      const load = teacherLoads[t._id.toString()] || 0;
      const max = t.maxPeriodsPerWeek || 30;
      if (load > max) {
        issues.push({
          type: 'overloaded',
          severity: 'error',
          message: `${t.name} is overloaded: ${load} periods assigned, max is ${max}`,
          teacherId: t._id, teacherName: t.name, load, max
        });
      }
    }

    // 5. Subjects with 0 periods
    for (const r of reqs) {
      if ((r.periodsPerWeek || 0) === 0) {
        issues.push({
          type: 'zero_periods',
          severity: 'info',
          message: `${r.subject?.name} for ${r.class?.name} has 0 periods per week`,
          classId: r.class?._id, subjectId: r.subject?._id
        });
      }
    }

    const errorCount = issues.filter(i => i.severity === 'error').length;
    const warningCount = issues.filter(i => i.severity === 'warning').length;
    const infoCount = issues.filter(i => i.severity === 'info').length;

    res.json({
      success: true,
      ready: errorCount === 0,
      summary: { errors: errorCount, warnings: warningCount, info: infoCount },
      issues
    });
  } catch (err) { next(err); }
};
