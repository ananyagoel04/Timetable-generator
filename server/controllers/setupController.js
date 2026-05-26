const School = require('../models/School');
const AcademicSession = require('../models/AcademicSession');
const PeriodStructure = require('../models/PeriodStructure');
const SoftPreference = require('../models/SoftPreference');
const Class = require('../models/Class');

const getScope = async () => {
  const school = await School.findOne();
  const session = await AcademicSession.findOne({ school: school?._id, isCurrent: true });
  return { school, session };
};

// --- School ---
exports.getSchool = async (req, res, next) => {
  try {
    let school = await School.findOne();
    if (!school) school = await School.create({ name: 'My School', code: 'SCH001' });
    res.json({ success: true, data: school });
  } catch (err) { next(err); }
};

exports.updateSchool = async (req, res, next) => {
  try {
    let school = await School.findOne();
    if (!school) school = await School.create({ name: 'My School', code: 'SCH001' });
    Object.assign(school, req.body);
    await school.save();
    res.json({ success: true, data: school });
  } catch (err) { next(err); }
};

// --- Academic Session ---
exports.getSessions = async (req, res, next) => {
  try {
    const { school } = await getScope();
    const sessions = await AcademicSession.find({ school: school?._id }).sort({ startDate: -1 });
    res.json({ success: true, data: sessions });
  } catch (err) { next(err); }
};

exports.createSession = async (req, res, next) => {
  try {
    const { school } = await getScope();
    const session = await AcademicSession.create({ ...req.body, school: school._id });
    res.status(201).json({ success: true, data: session });
  } catch (err) { next(err); }
};

exports.updateSession = async (req, res, next) => {
  try {
    const session = await AcademicSession.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!session) return res.status(404).json({ success: false, error: 'Session not found' });
    res.json({ success: true, data: session });
  } catch (err) { next(err); }
};

// --- Period Structure (single - backward compat) ---
exports.getPeriodStructure = async (req, res, next) => {
  try {
    const { school, session } = await getScope();
    let ps = await PeriodStructure.findOne({ school: school?._id, status: 'active' }).sort({ createdAt: -1 });
    if (!ps) {
      const defaultSlots = [
        { label: 'Period 1', slotNumber: 1, startTime: '08:00', endTime: '08:40', type: 'period', isSchedulable: true },
        { label: 'Period 2', slotNumber: 2, startTime: '08:40', endTime: '09:20', type: 'period', isSchedulable: true },
        { label: 'Period 3', slotNumber: 3, startTime: '09:20', endTime: '10:00', type: 'period', isSchedulable: true },
        { label: 'Short Break', slotNumber: 4, startTime: '10:00', endTime: '10:15', type: 'break', isSchedulable: false },
        { label: 'Period 4', slotNumber: 5, startTime: '10:15', endTime: '10:55', type: 'period', isSchedulable: true },
        { label: 'Period 5', slotNumber: 6, startTime: '10:55', endTime: '11:35', type: 'period', isSchedulable: true },
        { label: 'Lunch Break', slotNumber: 7, startTime: '11:35', endTime: '12:10', type: 'lunch', isSchedulable: false },
        { label: 'Period 6', slotNumber: 8, startTime: '12:10', endTime: '12:50', type: 'period', isSchedulable: true },
        { label: 'Period 7', slotNumber: 9, startTime: '12:50', endTime: '13:30', type: 'period', isSchedulable: true },
        { label: 'Period 8', slotNumber: 10, startTime: '13:30', endTime: '14:10', type: 'period', isSchedulable: true },
      ];
      ps = await PeriodStructure.create({
        school: school._id, session: session?._id, name: 'Default',
        workingDays: school.settings.workingDays, timeslots: defaultSlots
      });
    }
    res.json({ success: true, data: ps });
  } catch (err) { next(err); }
};

exports.updatePeriodStructure = async (req, res, next) => {
  try {
    const ps = await PeriodStructure.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!ps) return res.status(404).json({ success: false, error: 'Period structure not found' });
    res.json({ success: true, data: ps });
  } catch (err) { next(err); }
};

// --- Period Structures (multi) ---
exports.getPeriodStructures = async (req, res, next) => {
  try {
    const { school, session } = await getScope();
    const structures = await PeriodStructure.find({ school: school?._id })
      .populate('assignedTo.classes', 'name grade section')
      .sort({ status: 1, templateType: 1, name: 1 });
    res.json({ success: true, count: structures.length, data: structures });
  } catch (err) { next(err); }
};

exports.createPeriodStructure = async (req, res, next) => {
  try {
    const { school, session } = await getScope();
    const ps = await PeriodStructure.create({ ...req.body, school: school._id, session: session?._id });
    res.status(201).json({ success: true, data: ps });
  } catch (err) { next(err); }
};

exports.clonePeriodStructure = async (req, res, next) => {
  try {
    const source = await PeriodStructure.findById(req.params.id);
    if (!source) return res.status(404).json({ success: false, error: 'Source not found' });
    const clone = await PeriodStructure.create({
      school: source.school, session: source.session,
      name: req.body.name || `${source.name} (Copy)`,
      description: source.description, templateType: source.templateType,
      workingDays: source.workingDays, timeslots: source.timeslots,
      saturdayConfig: source.saturdayConfig, dayOverrides: source.dayOverrides,
      clonedFrom: source._id, status: 'draft', version: 1
    });
    res.status(201).json({ success: true, data: clone });
  } catch (err) { next(err); }
};

exports.assignPeriodStructure = async (req, res, next) => {
  try {
    const { classes, grades, streams, shifts } = req.body;
    const ps = await PeriodStructure.findByIdAndUpdate(req.params.id,
      { assignedTo: { classes, grades, streams, shifts } },
      { new: true, runValidators: true }
    ).populate('assignedTo.classes', 'name grade section');
    if (!ps) return res.status(404).json({ success: false, error: 'Period structure not found' });
    // Also update the Class documents to reference this structure
    if (classes && classes.length > 0) {
      await Class.updateMany({ _id: { $in: classes } }, { periodStructure: ps._id });
    }
    res.json({ success: true, data: ps });
  } catch (err) { next(err); }
};

exports.deletePeriodStructure = async (req, res, next) => {
  try {
    const ps = await PeriodStructure.findByIdAndUpdate(req.params.id, { status: 'archived' }, { new: true });
    if (!ps) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: ps });
  } catch (err) { next(err); }
};

// --- Soft Preferences ---
exports.getPreferences = async (req, res, next) => {
  try {
    const { school } = await getScope();
    const prefs = await SoftPreference.find({ school: school?._id }).sort({ priority: -1 });
    res.json({ success: true, count: prefs.length, data: prefs });
  } catch (err) { next(err); }
};

exports.createPreference = async (req, res, next) => {
  try {
    const { school, session } = await getScope();
    const pref = await SoftPreference.create({ ...req.body, school: school._id, session: session?._id });
    res.status(201).json({ success: true, data: pref });
  } catch (err) { next(err); }
};

exports.updatePreference = async (req, res, next) => {
  try {
    const pref = await SoftPreference.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!pref) return res.status(404).json({ success: false, error: 'Preference not found' });
    res.json({ success: true, data: pref });
  } catch (err) { next(err); }
};

exports.deletePreference = async (req, res, next) => {
  try {
    await SoftPreference.findByIdAndDelete(req.params.id);
    res.json({ success: true, data: {} });
  } catch (err) { next(err); }
};

// --- Setup Status (Enhanced with readiness scoring) ---
exports.getSetupStatus = async (req, res, next) => {
  try {
    const { school, session } = await getScope();
    const Teacher = require('../models/Teacher');
    const Room = require('../models/Room');
    const SubjectRequirement = require('../models/SubjectRequirement');
    const Subject = require('../models/Subject');
    const SubjectCombinationRule = require('../models/SubjectCombinationRule');
    const CanTeach = require('../models/CanTeach');
    const GeneratedTimetable = require('../models/GeneratedTimetable');
    const ConflictLog = require('../models/ConflictLog');

    const schoolId = school?._id;
    const sessionId = session?._id;

    const [teacherCount, classCount, subjectCount, roomCount, reqCount, psCount, combCount, canTeachCount] = await Promise.all([
      Teacher.countDocuments({ school: schoolId, status: 'active' }),
      Class.countDocuments({ school: schoolId, isActive: true }),
      Subject.countDocuments({ school: schoolId, isActive: true }),
      Room.countDocuments({ school: schoolId, isAvailable: true }),
      SubjectRequirement.countDocuments({ school: schoolId, session: sessionId }),
      PeriodStructure.countDocuments({ school: schoolId }),
      SubjectCombinationRule.countDocuments({ school: schoolId, session: sessionId, isActive: true }),
      CanTeach.countDocuments({ school: schoolId, isActive: true })
    ]);

    // Timetable status
    const latestTT = await GeneratedTimetable.findOne({ school: schoolId }).sort({ createdAt: -1 });
    let conflictCount = 0;
    if (latestTT) {
      conflictCount = await ConflictLog.countDocuments({ timetable: latestTT._id, isResolved: false });
    }

    // Step-by-step readiness
    const steps = [
      { key: 'school', label: 'School Profile', complete: !!school, required: true },
      { key: 'session', label: 'Academic Session', complete: !!session, required: true },
      { key: 'periodStructure', label: 'Period Structure', complete: psCount > 0, required: true },
      { key: 'classes', label: 'Classes', complete: classCount > 0, required: true, count: classCount },
      { key: 'subjects', label: 'Subjects', complete: subjectCount > 0, required: true, count: subjectCount },
      { key: 'teachers', label: 'Teachers', complete: teacherCount > 0, required: true, count: teacherCount },
      { key: 'rooms', label: 'Rooms', complete: roomCount > 0, required: false, count: roomCount },
      { key: 'canTeach', label: 'Teacher Capabilities', complete: canTeachCount > 0, required: false, count: canTeachCount },
      { key: 'requirements', label: 'Subject Requirements', complete: reqCount > 0, required: true, count: reqCount },
      { key: 'combinations', label: 'Combination Rules', complete: combCount >= 0, required: false, count: combCount },
    ];

    const requiredSteps = steps.filter(s => s.required);
    const completedRequired = requiredSteps.filter(s => s.complete).length;
    const completedAll = steps.filter(s => s.complete).length;
    const readinessScore = Math.round((completedRequired / requiredSteps.length) * 100);

    const canGenerate = requiredSteps.every(s => s.complete);

    res.json({
      success: true,
      data: {
        school: !!school,
        session: !!session,
        periodStructure: psCount > 0,
        teachers: teacherCount > 0,
        classes: classCount > 0,
        subjects: subjectCount > 0,
        rooms: roomCount > 0,
        requirements: reqCount > 0,
        counts: {
          teachers: teacherCount, classes: classCount, subjects: subjectCount,
          rooms: roomCount, requirements: reqCount, periodStructures: psCount,
          combinations: combCount, canTeach: canTeachCount
        },
        steps,
        readinessScore,
        canGenerate,
        completedSteps: completedAll,
        totalSteps: steps.length,
        latestTimetable: latestTT ? {
          _id: latestTT._id,
          status: latestTT.status,
          qualityScore: latestTT.qualityScore,
          conflicts: conflictCount,
          createdAt: latestTT.createdAt
        } : null
      }
    });
  } catch (err) { next(err); }
};

// --- Readiness Audit (Deep Validation) ---
exports.getReadinessAudit = async (req, res, next) => {
  try {
    const { school, session } = await getScope();
    const Teacher = require('../models/Teacher');
    const Room = require('../models/Room');
    const SubjectRequirement = require('../models/SubjectRequirement');
    const Subject = require('../models/Subject');
    const CanTeach = require('../models/CanTeach');
    const ReservedPeriodRule = require('../models/ReservedPeriodRule');

    const schoolId = school?._id;
    const sessionId = session?._id;

    const [teachers, classes, subjects, rooms, requirements, canTeachMappings, reserved] = await Promise.all([
      Teacher.find({ school: schoolId, status: 'active' }),
      Class.find({ school: schoolId, isActive: true }),
      Subject.find({ school: schoolId, isActive: true }),
      Room.find({ school: schoolId, isAvailable: true }),
      SubjectRequirement.find({ school: schoolId, session: sessionId }),
      CanTeach.find({ school: schoolId, isActive: true }),
      ReservedPeriodRule.find({ school: schoolId })
    ]);

    const warnings = [];
    const errors = [];

    // 1. Subjects without any requirements
    const subjectsWithReqs = new Set(requirements.map(r => r.subject?.toString()));
    const orphanSubjects = subjects.filter(s => !subjectsWithReqs.has(s._id.toString()));
    if (orphanSubjects.length > 0) {
      warnings.push({ type: 'orphan_subjects', message: `${orphanSubjects.length} subject(s) have no weekly load assigned`, items: orphanSubjects.map(s => s.name) });
    }

    // 2. Classes without any requirements
    const classesWithReqs = new Set(requirements.map(r => r.class?.toString()));
    const uncoveredClasses = classes.filter(c => !classesWithReqs.has(c._id.toString()));
    if (uncoveredClasses.length > 0) {
      errors.push({ type: 'uncovered_classes', message: `${uncoveredClasses.length} class(es) have no subject requirements`, items: uncoveredClasses.map(c => c.name) });
    }

    // 3. Teachers without CanTeach mappings
    const teachersWithCT = new Set(canTeachMappings.map(ct => ct.teacher?.toString()));
    const unmappedTeachers = teachers.filter(t => !teachersWithCT.has(t._id.toString()));
    if (unmappedTeachers.length > 0) {
      warnings.push({ type: 'unmapped_teachers', message: `${unmappedTeachers.length} teacher(s) have no subject capabilities assigned`, items: unmappedTeachers.map(t => t.name) });
    }

    // 4. Requirements without a valid teacher capable of teaching
    const reqSubjectIds = [...new Set(requirements.map(r => r.subject?.toString()))];
    const teachableSubjectIds = new Set(canTeachMappings.map(ct => ct.subject?.toString()));
    const unteachableSubjects = reqSubjectIds.filter(sid => !teachableSubjectIds.has(sid));
    if (unteachableSubjects.length > 0) {
      const names = unteachableSubjects.map(sid => subjects.find(s => s._id.toString() === sid)?.name || sid);
      errors.push({ type: 'unteachable_subjects', message: `${unteachableSubjects.length} subject(s) required but no teacher can teach them`, items: names });
    }

    // 5. Period structure missing
    const ps = await PeriodStructure.findOne({ school: schoolId, status: 'active' });
    if (!ps) {
      errors.push({ type: 'no_period_structure', message: 'No active period structure defined' });
    }

    // 6. Total weekly load check
    if (ps) {
      const schedulablePeriods = ps.timeslots.filter(ts => ts.isSchedulable).length;
      const workingDays = school?.settings?.workingDays?.length || 6;
      const totalSlotsPerWeek = schedulablePeriods * workingDays;

      for (const cls of classes) {
        const classReqs = requirements.filter(r => r.class?.toString() === cls._id.toString());
        const totalRequired = classReqs.reduce((sum, r) => sum + (r.periodsPerWeek || 0), 0);
        if (totalRequired > totalSlotsPerWeek) {
          errors.push({ type: 'overloaded_class', message: `${cls.name}: requires ${totalRequired} periods/week but only ${totalSlotsPerWeek} slots available` });
        }
      }
    }

    // 7. No rooms
    if (rooms.length === 0) {
      warnings.push({ type: 'no_rooms', message: 'No rooms defined — timetable will generate without room assignments' });
    }

    const readyToGenerate = errors.length === 0;

    res.json({
      success: true,
      data: {
        readyToGenerate,
        errors,
        warnings,
        summary: {
          teachers: teachers.length, classes: classes.length, subjects: subjects.length,
          rooms: rooms.length, requirements: requirements.length, canTeach: canTeachMappings.length,
          reserved: reserved.length
        }
      }
    });
  } catch (err) { next(err); }
};

// --- Validate Step ---
exports.validateStep = async (req, res, next) => {
  try {
    const { stepKey } = req.body;
    const { school, session } = await getScope();
    const schoolId = school?._id;
    const sessionId = session?._id;

    const result = { valid: false, errors: [], warnings: [] };

    switch (stepKey) {
      case 'school':
        if (!school?.name || !school?.code) result.errors.push('School name and code are required');
        if (!school?.settings?.workingDays?.length) result.errors.push('At least one working day must be selected');
        else result.valid = true;
        break;

      case 'session':
        if (!session) result.errors.push('No active academic session configured');
        else result.valid = true;
        break;

      case 'periodStructure': {
        const ps = await PeriodStructure.findOne({ school: schoolId, status: 'active' });
        if (!ps || !ps.timeslots?.length) result.errors.push('No active period structure found');
        else {
          const schedulable = ps.timeslots.filter(t => t.isSchedulable).length;
          if (schedulable < 4) result.warnings.push(`Only ${schedulable} schedulable periods — consider adding more`);
          result.valid = true;
        }
        break;
      }

      case 'classes': {
        const count = await Class.countDocuments({ school: schoolId, isActive: true });
        if (count === 0) result.errors.push('At least one class must be created');
        else result.valid = true;
        break;
      }

      case 'subjects': {
        const Subject = require('../models/Subject');
        const count = await Subject.countDocuments({ school: schoolId, isActive: true });
        if (count === 0) result.errors.push('At least one subject must be created');
        else result.valid = true;
        break;
      }

      case 'teachers': {
        const Teacher = require('../models/Teacher');
        const count = await Teacher.countDocuments({ school: schoolId, status: 'active' });
        if (count === 0) result.errors.push('At least one teacher must be added');
        else result.valid = true;
        break;
      }

      case 'rooms': {
        const Room = require('../models/Room');
        const count = await Room.countDocuments({ school: schoolId, isAvailable: true });
        if (count === 0) result.warnings.push('No rooms — generation will skip room assignment');
        result.valid = true; // Rooms are optional
        break;
      }

      case 'canTeach': {
        const CanTeach = require('../models/CanTeach');
        const count = await CanTeach.countDocuments({ school: schoolId, isActive: true });
        if (count === 0) result.warnings.push('No teacher capabilities mapped — engine may not assign teachers optimally');
        result.valid = true; // Optional but recommended
        break;
      }

      case 'requirements': {
        const SubjectRequirement = require('../models/SubjectRequirement');
        const count = await SubjectRequirement.countDocuments({ school: schoolId, session: sessionId });
        if (count === 0) result.errors.push('Weekly subject loads must be configured for at least one class');
        else result.valid = true;
        break;
      }

      case 'combinations': {
        result.valid = true; // Always optional
        break;
      }

      case 'reserved': {
        result.valid = true; // Always optional
        break;
      }

      case 'preferences': {
        result.valid = true; // Always optional
        break;
      }

      case 'readiness': {
        // Delegate to readiness audit
        result.valid = true;
        break;
      }

      default:
        result.valid = true;
    }

    if (result.errors.length === 0 && !result.valid) result.valid = true;

    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};
