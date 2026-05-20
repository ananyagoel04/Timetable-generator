const SubjectRequirement = require('../models/SubjectRequirement');
const SubjectCombinationRule = require('../models/SubjectCombinationRule');
const ReservedPeriodRule = require('../models/ReservedPeriodRule');
const CustomRule = require('../models/CustomRule');
const School = require('../models/School');
const AcademicSession = require('../models/AcademicSession');

const getScope = async () => {
  const school = await School.findOne();
  const session = await AcademicSession.findOne({ school: school?._id, isCurrent: true });
  return { school: school?._id, session: session?._id };
};

// --- Subject Requirements ---
exports.getRequirements = async (req, res, next) => {
  try {
    const scope = await getScope();
    const reqs = await SubjectRequirement.find({ school: scope.school, session: scope.session })
      .populate('class subject teacher preferredRoom').sort({ 'class': 1 });
    res.json({ success: true, count: reqs.length, data: reqs });
  } catch (err) { next(err); }
};

exports.createRequirement = async (req, res, next) => {
  try {
    const scope = await getScope();
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

// --- Combination Rules ---
exports.getCombinationRules = async (req, res, next) => {
  try {
    const scope = await getScope();
    const rules = await SubjectCombinationRule.find({ school: scope.school, session: scope.session })
      .populate('subject teacher room appliesTo.class');
    res.json({ success: true, count: rules.length, data: rules });
  } catch (err) { next(err); }
};

exports.createCombinationRule = async (req, res, next) => {
  try {
    const scope = await getScope();
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
    const scope = await getScope();
    const rules = await ReservedPeriodRule.find({ school: scope.school, session: scope.session }).populate('subject teacher room');
    res.json({ success: true, count: rules.length, data: rules });
  } catch (err) { next(err); }
};

exports.createReservedRule = async (req, res, next) => {
  try {
    const scope = await getScope();
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
    const scope = await getScope();
    const rules = await CustomRule.find({ school: scope.school });
    res.json({ success: true, count: rules.length, data: rules });
  } catch (err) { next(err); }
};

exports.createCustomRule = async (req, res, next) => {
  try {
    const scope = await getScope();
    const rule = await CustomRule.create({ ...req.body, school: scope.school });
    res.status(201).json({ success: true, data: rule });
  } catch (err) { next(err); }
};
