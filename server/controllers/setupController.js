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
