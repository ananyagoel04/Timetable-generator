const SubjectRequirement = require('../models/SubjectRequirement');
const Teacher = require('../models/Teacher');
const Class = require('../models/Class');
const Subject = require('../models/Subject');
const PeriodStructure = require('../models/PeriodStructure');
const School = require('../models/School');
const AcademicSession = require('../models/AcademicSession');

const getScope = async () => {
  const school = await School.findOne();
  const session = await AcademicSession.findOne({ school: school?._id, isCurrent: true });
  return { school: school?._id, session: session?._id };
};

/**
 * GET /api/requirements - Get all requirements with full population
 */
exports.getAll = async (req, res, next) => {
  try {
    const scope = await getScope();
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
    const scope = await getScope();
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
    const scope = await getScope();
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
    const scope = await getScope();
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
    const scope = await getScope();

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
    const scope = await getScope();
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
        // Find possible redistribution targets
        const excessPeriods = entry.totalPeriods - max;
        const candidates = [];

        entry.reqs.forEach(r => {
          const subjectId = r.subject?._id?.toString();
          // Find other teachers who can teach this subject
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

    // Find unassigned subjects
    const classes = await Class.find({ school: scope.school, session: scope.session, isActive: true });
    const subjects = await Subject.find({ school: scope.school, session: scope.session, isActive: true });

    classes.forEach(cls => {
      subjects.forEach(sub => {
        const hasReq = reqs.some(r =>
          r.class?._id?.toString() === cls._id.toString() &&
          r.subject?._id?.toString() === sub._id.toString()
        );
        if (!hasReq && sub.category === 'core') {
          suggestions.push({
            type: 'unassigned',
            severity: 'info',
            message: `${sub.name} is not assigned to ${cls.name}`,
            class: cls.name,
            subject: sub.name
          });
        }
      });
    });

    res.json({ success: true, count: suggestions.length, data: suggestions });
  } catch (err) { next(err); }
};
