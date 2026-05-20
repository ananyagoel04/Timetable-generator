const School = require('../models/School');
const AcademicSession = require('../models/AcademicSession');
const PeriodStructure = require('../models/PeriodStructure');

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
    const school = await School.findOne();
    const sessions = await AcademicSession.find({ school: school?._id }).sort({ startDate: -1 });
    res.json({ success: true, data: sessions });
  } catch (err) { next(err); }
};

exports.createSession = async (req, res, next) => {
  try {
    const school = await School.findOne();
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

// --- Period Structure ---
exports.getPeriodStructure = async (req, res, next) => {
  try {
    const school = await School.findOne();
    let ps = await PeriodStructure.findOne({ school: school?._id }).sort({ createdAt: -1 });
    if (!ps) {
      // Create default
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
      const session = await AcademicSession.findOne({ school: school?._id, isCurrent: true });
      ps = await PeriodStructure.create({
        school: school._id, session: session?._id,
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
