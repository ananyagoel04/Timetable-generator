const Absence = require('../models/Absence');
const School = require('../models/School');

exports.getAbsences = async (req, res, next) => {
  try {
    const school = await School.findOne();
    const absences = await Absence.find({ school: school?._id }).populate('teacher').sort({ date: -1 });
    res.json({ success: true, count: absences.length, data: absences });
  } catch (err) { next(err); }
};
exports.createAbsence = async (req, res, next) => {
  try {
    const school = await School.findOne();
    const absence = await Absence.create({ ...req.body, school: school._id });
    const populated = await absence.populate('teacher');
    res.status(201).json({ success: true, data: populated });
  } catch (err) { next(err); }
};
exports.updateAbsence = async (req, res, next) => {
  try {
    const absence = await Absence.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }).populate('teacher');
    if (!absence) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: absence });
  } catch (err) { next(err); }
};
exports.deleteAbsence = async (req, res, next) => {
  try { await Absence.findByIdAndDelete(req.params.id); res.json({ success: true, data: {} }); }
  catch (err) { next(err); }
};
