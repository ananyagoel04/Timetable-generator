const AcademicSession = require('../models/AcademicSession');
const AuditLog = require('../models/AuditLog');
const { isPlatformRole } = require('../middleware/auth');

/**
 * GET /api/sessions — list sessions for current school
 */
exports.getSessions = async (req, res, next) => {
  try {
    if (!req.schoolId) return res.status(400).json({ success: false, error: 'School context required' });
    const sessions = await AcademicSession.find({ school: req.schoolId }).sort({ startDate: -1 });
    res.json({ success: true, count: sessions.length, data: sessions });
  } catch (err) { next(err); }
};

/**
 * GET /api/sessions/current — get current active session for school
 */
exports.getCurrentSession = async (req, res, next) => {
  try {
    if (!req.schoolId) return res.status(400).json({ success: false, error: 'School context required' });
    const session = await AcademicSession.findOne({ school: req.schoolId, isCurrent: true });
    if (!session) return res.status(404).json({ success: false, error: 'No active session found' });
    res.json({ success: true, data: session });
  } catch (err) { next(err); }
};

/**
 * POST /api/sessions — create new session for school
 */
exports.createSession = async (req, res, next) => {
  try {
    if (!req.schoolId) return res.status(400).json({ success: false, error: 'School context required' });
    const { name, startDate, endDate, status } = req.body;
    if (!name || !startDate || !endDate) {
      return res.status(400).json({ success: false, error: 'Name, startDate, and endDate are required' });
    }

    const session = await AcademicSession.create({
      school: req.schoolId,
      name,
      startDate,
      endDate,
      isCurrent: false,
      status: status || 'draft'
    });

    await AuditLog.create({
      school: req.schoolId,
      action: 'create',
      entityType: 'session',
      entityId: session._id,
      user: req.user?._id,
      source: 'manual',
      newValue: { name: session.name, status: session.status }
    });

    res.status(201).json({ success: true, data: session });
  } catch (err) { next(err); }
};

/**
 * PUT /api/sessions/:id — update session
 */
exports.updateSession = async (req, res, next) => {
  try {
    const session = await AcademicSession.findById(req.params.id);
    if (!session) return res.status(404).json({ success: false, error: 'Session not found' });
    
    // Security: verify session belongs to current school
    if (session.school.toString() !== req.schoolId?.toString()) {
      return res.status(403).json({ success: false, error: 'Session does not belong to your school' });
    }

    const { name, startDate, endDate } = req.body;
    if (name) session.name = name;
    if (startDate) session.startDate = startDate;
    if (endDate) session.endDate = endDate;
    await session.save();

    res.json({ success: true, data: session });
  } catch (err) { next(err); }
};

/**
 * PUT /api/sessions/:id/activate — activate session (deactivates others)
 */
exports.activateSession = async (req, res, next) => {
  try {
    const session = await AcademicSession.findById(req.params.id);
    if (!session) return res.status(404).json({ success: false, error: 'Session not found' });
    
    if (session.school.toString() !== req.schoolId?.toString()) {
      return res.status(403).json({ success: false, error: 'Session does not belong to your school' });
    }

    // Deactivate all other sessions for this school
    await AcademicSession.updateMany(
      { school: session.school, _id: { $ne: session._id } },
      { isCurrent: false, status: 'archived' }
    );
    session.isCurrent = true;
    session.status = 'active';
    await session.save();

    await AuditLog.create({
      school: req.schoolId,
      action: 'update',
      entityType: 'session',
      entityId: session._id,
      user: req.user?._id,
      source: 'manual',
      newValue: { name: session.name, action: 'activated' }
    });

    res.json({ success: true, data: session });
  } catch (err) { next(err); }
};

/**
 * PUT /api/sessions/:id/archive — archive session (does not delete data)
 */
exports.archiveSession = async (req, res, next) => {
  try {
    const session = await AcademicSession.findById(req.params.id);
    if (!session) return res.status(404).json({ success: false, error: 'Session not found' });
    
    if (session.school.toString() !== req.schoolId?.toString()) {
      return res.status(403).json({ success: false, error: 'Session does not belong to your school' });
    }

    session.isCurrent = false;
    session.status = 'archived';
    await session.save();

    await AuditLog.create({
      school: req.schoolId,
      action: 'update',
      entityType: 'session',
      entityId: session._id,
      user: req.user?._id,
      source: 'manual',
      newValue: { name: session.name, action: 'archived' }
    });

    res.json({ success: true, data: session });
  } catch (err) { next(err); }
};

/**
 * POST /api/sessions/:id/copy-setup — copy setup from source session
 */
exports.copySessionSetup = async (req, res, next) => {
  try {
    const { sourceSessionId } = req.body;
    const targetSession = await AcademicSession.findById(req.params.id);
    if (!targetSession) return res.status(404).json({ success: false, error: 'Target session not found' });

    const sourceSession = await AcademicSession.findById(sourceSessionId);
    if (!sourceSession) return res.status(404).json({ success: false, error: 'Source session not found' });

    // Security: both sessions must belong to the current school
    if (targetSession.school.toString() !== req.schoolId?.toString() || 
        sourceSession.school.toString() !== req.schoolId?.toString()) {
      return res.status(403).json({ success: false, error: 'Sessions must belong to your school' });
    }

    const Class = require('../models/Class');
    const SubjectRequirement = require('../models/SubjectRequirement');
    const CanTeach = require('../models/CanTeach');
    const PeriodStructure = require('../models/PeriodStructure');
    const copied = { classes: 0, requirements: 0, periodStructures: 0, canTeach: 0 };

    // Copy classes
    const sourceClasses = await Class.find({ school: req.schoolId, session: sourceSessionId, isActive: true });
    const classIdMap = {};
    for (const cls of sourceClasses) {
      const obj = cls.toObject();
      delete obj._id; delete obj.createdAt; delete obj.updatedAt; delete obj.__v;
      obj.session = targetSession._id;
      const newCls = await Class.create(obj);
      classIdMap[cls._id.toString()] = newCls._id;
      copied.classes++;
    }

    // Copy requirements
    const sourceReqs = await SubjectRequirement.find({ school: req.schoolId, session: sourceSessionId });
    for (const r of sourceReqs) {
      const obj = r.toObject();
      delete obj._id; delete obj.createdAt; delete obj.updatedAt; delete obj.__v;
      obj.session = targetSession._id;
      if (classIdMap[obj.class?.toString()]) obj.class = classIdMap[obj.class.toString()];
      await SubjectRequirement.create(obj);
      copied.requirements++;
    }

    // Copy period structures
    const sourcePS = await PeriodStructure.find({ school: req.schoolId, session: sourceSessionId });
    for (const ps of sourcePS) {
      const obj = ps.toObject();
      delete obj._id; delete obj.createdAt; delete obj.updatedAt; delete obj.__v;
      obj.session = targetSession._id;
      obj.status = 'active';
      obj.clonedFrom = ps._id;
      if (obj.assignedTo?.classes?.length) {
        obj.assignedTo.classes = obj.assignedTo.classes.map(cid => classIdMap[cid?.toString()] || cid);
      }
      await PeriodStructure.create(obj);
      copied.periodStructures++;
    }

    // Copy CanTeach mappings
    const sourceCT = await CanTeach.find({ school: req.schoolId, session: sourceSessionId, isActive: true });
    for (const ct of sourceCT) {
      const obj = ct.toObject();
      delete obj._id; delete obj.createdAt; delete obj.updatedAt; delete obj.__v;
      obj.session = targetSession._id;
      if (obj.eligibleClasses?.length) {
        obj.eligibleClasses = obj.eligibleClasses.map(cid => classIdMap[cid?.toString()] || cid);
      }
      await CanTeach.create(obj);
      copied.canTeach++;
    }

    await AuditLog.create({
      school: req.schoolId,
      action: 'create',
      entityType: 'session',
      entityId: targetSession._id,
      user: req.user?._id,
      source: 'manual',
      newValue: { action: 'copy_setup', source: sourceSession.name, target: targetSession.name, copied }
    });

    res.json({ success: true, data: { targetSession: targetSession._id, copied } });
  } catch (err) { next(err); }
};
