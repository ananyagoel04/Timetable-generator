const SubjectRequirement = require('../models/SubjectRequirement');
const SubjectCombinationRule = require('../models/SubjectCombinationRule');
const ReservedPeriodRule = require('../models/ReservedPeriodRule');
const CustomRule = require('../models/CustomRule');
const Class = require('../models/Class');
const Teacher = require('../models/Teacher');
const School = require('../models/School');
const AcademicSession = require('../models/AcademicSession');

const getScope = async (req) => {
  const schoolId = req.schoolId;
  const sessionId = req.sessionId;
  let session = null;
  if (sessionId) session = await AcademicSession.findById(sessionId);
  else if (schoolId) session = await AcademicSession.findOne({ school: schoolId, isCurrent: true });
  return { school: schoolId, session: session?._id };
};

// --- Subject Requirements ---
exports.getRequirements = async (req, res, next) => {
  try {
    const scope = await getScope(req);
    const filter = { school: scope.school, session: scope.session };

    // Advanced filtering
    if (req.query.classIds) {
      const ids = req.query.classIds.split(',').map(id => id.trim()).filter(Boolean);
      if (ids.length > 0) filter.class = { $in: ids };
    }
    if (req.query.subjectId) {
      filter.subject = req.query.subjectId;
    }
    if (req.query.grade || req.query.stream) {
      // Need to find matching classes first
      const classFilter = { school: scope.school, session: scope.session };
      if (req.query.grade) classFilter.grade = parseInt(req.query.grade);
      if (req.query.stream) classFilter.stream = req.query.stream;
      const matchingClasses = await Class.find(classFilter).select('_id');
      const classIds = matchingClasses.map(c => c._id);
      if (filter.class) {
        // Intersect with existing class filter
        filter.class = { $in: classIds.filter(id => filter.class.$in.includes(id.toString())) };
      } else {
        filter.class = { $in: classIds };
      }
    }

    const reqs = await SubjectRequirement.find(filter)
      .populate('class subject teacher preferredRoom').sort({ 'class': 1 });
    res.json({ success: true, count: reqs.length, data: reqs });
  } catch (err) { next(err); }
};

exports.createRequirement = async (req, res, next) => {
  try {
    const scope = await getScope(req);
    const req_ = await SubjectRequirement.create({ ...req.body, ...scope });
    res.status(201).json({ success: true, data: req_ });
  } catch (err) { next(err); }
};

exports.updateRequirement = async (req, res, next) => {
  try {
    const doc = await SubjectRequirement.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!doc) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: doc });
  } catch (err) { next(err); }
};

exports.deleteRequirement = async (req, res, next) => {
  try {
    await SubjectRequirement.findByIdAndDelete(req.params.id);
    res.json({ success: true, data: {} });
  } catch (err) { next(err); }
};

// --- Bulk Operations ---
exports.bulkCreateRequirements = async (req, res, next) => {
  try {
    const scope = await getScope(req);
    const { classIds, subject, teacher, periodsPerWeek, ...otherFields } = req.body;

    if (!classIds || !Array.isArray(classIds) || classIds.length === 0) {
      return res.status(400).json({ success: false, error: 'classIds array is required' });
    }
    if (!subject || !teacher || !periodsPerWeek) {
      return res.status(400).json({ success: false, error: 'subject, teacher, and periodsPerWeek are required' });
    }

    const docs = classIds.map(classId => ({
      ...otherFields,
      class: classId,
      subject,
      teacher,
      periodsPerWeek,
      school: scope.school,
      session: scope.session
    }));

    const created = await SubjectRequirement.insertMany(docs);
    res.status(201).json({ success: true, count: created.length, data: created });
  } catch (err) { next(err); }
};

exports.bulkUpdateRequirements = async (req, res, next) => {
  try {
    const { ids, updates } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: 'ids array is required' });
    }
    if (!updates || Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, error: 'updates object is required' });
    }

    // Prevent updating scope fields
    delete updates.school;
    delete updates.session;

    const result = await SubjectRequirement.updateMany(
      { _id: { $in: ids } },
      { $set: updates },
      { runValidators: true }
    );

    const updated = await SubjectRequirement.find({ _id: { $in: ids } })
      .populate('class subject teacher preferredRoom');

    res.json({ success: true, matchedCount: result.matchedCount, modifiedCount: result.modifiedCount, data: updated });
  } catch (err) { next(err); }
};

exports.cloneRequirements = async (req, res, next) => {
  try {
    const scope = await getScope(req);
    const { sourceClassId, targetClassIds, teacherMapping } = req.body;

    if (!sourceClassId) {
      return res.status(400).json({ success: false, error: 'sourceClassId is required' });
    }
    if (!targetClassIds || !Array.isArray(targetClassIds) || targetClassIds.length === 0) {
      return res.status(400).json({ success: false, error: 'targetClassIds array is required' });
    }

    const sourceReqs = await SubjectRequirement.find({
      school: scope.school, session: scope.session, class: sourceClassId
    });

    if (sourceReqs.length === 0) {
      return res.status(404).json({ success: false, error: 'No requirements found for source class' });
    }

    const clonedDocs = [];
    for (const targetClassId of targetClassIds) {
      for (const srcReq of sourceReqs) {
        let teacherId = srcReq.teacher;
        if (teacherMapping && teacherMapping[srcReq.teacher.toString()]) {
          teacherId = teacherMapping[srcReq.teacher.toString()];
        }
        clonedDocs.push({
          school: scope.school,
          session: scope.session,
          class: targetClassId,
          subject: srcReq.subject,
          teacher: teacherId,
          periodsPerWeek: srcReq.periodsPerWeek,
          preferredRoom: srcReq.preferredRoom,
          studentGroup: srcReq.studentGroup,
          allowDoublePeriod: srcReq.allowDoublePeriod,
          doublePeriodsPerWeek: srcReq.doublePeriodsPerWeek,
          consecutivePreference: srcReq.consecutivePreference,
          consecutiveCount: srcReq.consecutiveCount,
          preferredDays: srcReq.preferredDays,
          avoidDays: srcReq.avoidDays,
          isActive: srcReq.isActive
        });
      }
    }

    const created = await SubjectRequirement.insertMany(clonedDocs);
    res.status(201).json({
      success: true,
      count: created.length,
      data: created,
      message: `Cloned ${sourceReqs.length} requirements to ${targetClassIds.length} classes`
    });
  } catch (err) { next(err); }
};

exports.getWorkloadSummary = async (req, res, next) => {
  try {
    const scope = await getScope(req);
    const schoolId = req.query.school || scope.school;
    const sessionId = req.query.session || scope.session;

    const [classes, teachers, requirements] = await Promise.all([
      Class.find({ school: schoolId, session: sessionId, isActive: true }).sort({ grade: 1, section: 1 }),
      Teacher.find({ school: schoolId, session: sessionId, status: 'active' }),
      SubjectRequirement.find({ school: schoolId, session: sessionId, isActive: true }).populate('subject teacher class')
    ]);

    const warnings = [];

    // Class workload
    const classData = classes.map(cls => {
      const classReqs = requirements.filter(r => r.class?._id?.toString() === cls._id.toString());
      const totalPeriods = classReqs.reduce((sum, r) => sum + r.periodsPerWeek, 0);
      // Estimate available slots: working days * schedulable periods per day
      const availableSlots = 6 * 7; // approximate: 6 days * 7 periods
      const utilization = availableSlots > 0 ? Math.round((totalPeriods / availableSlots) * 100) : 0;

      if (utilization > 100) {
        warnings.push(`Class ${cls.name} is over-scheduled: ${totalPeriods} periods requested vs ${availableSlots} available`);
      }
      if (totalPeriods === 0) {
        warnings.push(`Class ${cls.name} has no subject requirements assigned`);
      }

      return {
        classId: cls._id,
        className: cls.name,
        totalPeriods,
        availableSlots,
        utilization,
        subjects: classReqs.map(r => ({
          name: r.subject?.name || 'Unknown',
          periods: r.periodsPerWeek
        }))
      };
    });

    // Teacher workload
    const teacherData = teachers.map(teacher => {
      const teacherReqs = requirements.filter(r => r.teacher?._id?.toString() === teacher._id.toString());
      const totalPeriods = teacherReqs.reduce((sum, r) => sum + r.periodsPerWeek, 0);
      const maxPerWeek = teacher.maxPeriodsPerWeek || 30;
      const utilization = maxPerWeek > 0 ? Math.round((totalPeriods / maxPerWeek) * 100) : 0;

      if (utilization > 100) {
        warnings.push(`Teacher ${teacher.name} is over-loaded: ${totalPeriods} periods assigned vs ${maxPerWeek} max`);
      }
      if (totalPeriods === 0) {
        warnings.push(`Teacher ${teacher.name} has no assigned periods`);
      }

      return {
        teacherId: teacher._id,
        name: teacher.name,
        totalPeriods,
        maxPerWeek,
        utilization
      };
    });

    res.json({
      success: true,
      data: {
        classes: classData,
        teachers: teacherData,
        warnings
      }
    });
  } catch (err) { next(err); }
};

// --- Combination Rules ---
exports.getCombinationRules = async (req, res, next) => {
  try {
    const scope = await getScope(req);
    const rules = await SubjectCombinationRule.find({ school: scope.school, session: scope.session })
      .populate('subject teacher room appliesTo.class');
    res.json({ success: true, count: rules.length, data: rules });
  } catch (err) { next(err); }
};

exports.createCombinationRule = async (req, res, next) => {
  try {
    const scope = await getScope(req);
    const rule = await SubjectCombinationRule.create({ ...req.body, ...scope });
    res.status(201).json({ success: true, data: rule });
  } catch (err) { next(err); }
};

exports.updateCombinationRule = async (req, res, next) => {
  try {
    const doc = await SubjectCombinationRule.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!doc) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: doc });
  } catch (err) { next(err); }
};

exports.deleteCombinationRule = async (req, res, next) => {
  try {
    await SubjectCombinationRule.findByIdAndDelete(req.params.id);
    res.json({ success: true, data: {} });
  } catch (err) { next(err); }
};

// --- Reserved Period Rules ---
exports.getReservedRules = async (req, res, next) => {
  try {
    const scope = await getScope(req);
    const rules = await ReservedPeriodRule.find({ school: scope.school, session: scope.session }).populate('subject teacher room');
    res.json({ success: true, count: rules.length, data: rules });
  } catch (err) { next(err); }
};

exports.createReservedRule = async (req, res, next) => {
  try {
    const scope = await getScope(req);
    const rule = await ReservedPeriodRule.create({ ...req.body, ...scope });
    res.status(201).json({ success: true, data: rule });
  } catch (err) { next(err); }
};

exports.updateReservedRule = async (req, res, next) => {
  try {
    const doc = await ReservedPeriodRule.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    res.json({ success: true, data: doc });
  } catch (err) { next(err); }
};

exports.deleteReservedRule = async (req, res, next) => {
  try { await ReservedPeriodRule.findByIdAndDelete(req.params.id); res.json({ success: true, data: {} }); }
  catch (err) { next(err); }
};

// --- Custom Rules ---
exports.getCustomRules = async (req, res, next) => {
  try {
    const scope = await getScope(req);
    const rules = await CustomRule.find({ school: scope.school });
    res.json({ success: true, count: rules.length, data: rules });
  } catch (err) { next(err); }
};

exports.createCustomRule = async (req, res, next) => {
  try {
    const scope = await getScope(req);
    const rule = await CustomRule.create({ ...req.body, school: scope.school });
    res.status(201).json({ success: true, data: rule });
  } catch (err) { next(err); }
};
