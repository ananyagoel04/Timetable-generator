const Class = require('../models/Class');

exports.getClasses = async (req, res, next) => {
  try {
    if (!req.schoolId) return res.status(400).json({ success: false, error: 'School context required' });
    const filter = { school: req.schoolId };
    if (req.sessionId) filter.session = req.sessionId;
    const classes = await Class.find(filter)
      .populate('classTeacher roomPreference periodStructure').sort({ grade: 1, section: 1 });
    res.json({ success: true, count: classes.length, data: classes });
  } catch (err) { next(err); }
};

exports.getClass = async (req, res, next) => {
  try {
    const c = await Class.findOne({ _id: req.params.id, school: req.schoolId })
      .populate('classTeacher roomPreference periodStructure');
    if (!c) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: c });
  } catch (err) { next(err); }
};

exports.createClass = async (req, res, next) => {
  try {
    if (!req.schoolId) return res.status(400).json({ success: false, error: 'School context required' });
    const c = await Class.create({
      ...req.body,
      school: req.schoolId,
      session: req.sessionId || req.body.session
    });
    res.status(201).json({ success: true, data: c });
  } catch (err) { next(err); }
};

exports.updateClass = async (req, res, next) => {
  try {
    const c = await Class.findOneAndUpdate(
      { _id: req.params.id, school: req.schoolId },
      req.body,
      { new: true, runValidators: true }
    );
    if (!c) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: c });
  } catch (err) { next(err); }
};

exports.deleteClass = async (req, res, next) => {
  try {
    const result = await Class.findOneAndDelete({ _id: req.params.id, school: req.schoolId });
    if (!result) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: {} });
  } catch (err) { next(err); }
};
