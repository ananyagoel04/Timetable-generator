const Teacher = require('../models/Teacher');
const Class = require('../models/Class');
const Subject = require('../models/Subject');
const Room = require('../models/Room');
const User = require('../models/User');
const School = require('../models/School');
const Absence = require('../models/Absence');
const GeneratedTimetable = require('../models/GeneratedTimetable');
const AuditLog = require('../models/AuditLog');
const PeriodStructure = require('../models/PeriodStructure');
const Substitution = require('../models/Substitution');

/**
 * ERP-wide intelligent search across ALL entities
 * GET /api/search?q=searchTerm
 */
exports.globalSearch = async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) {
      return res.status(400).json({ success: false, error: 'Search query must be at least 2 characters' });
    }

    const school = await School.findOne();
    if (!school) return res.status(404).json({ success: false, error: 'School not found' });

    const regex = new RegExp(q.trim(), 'i');
    const limit = 5;

    // Search all entity types in parallel
    const [teachers, subjects, rooms, users, absences, timetables, periodStructures] = await Promise.all([
      Teacher.find({ school: school._id, $or: [{ name: regex }, { email: regex }, { shortName: regex }, { department: regex }] })
        .limit(limit).select('name shortName email department status'),

      Subject.find({ school: school._id, $or: [{ name: regex }, { code: regex }, { shortName: regex }] })
        .limit(limit).select('name code color type shortName'),

      Room.find({ school: school._id, $or: [{ name: regex }, { roomNumber: regex }, { type: regex }] })
        .limit(limit).select('name roomNumber type capacity'),

      User.find({ $or: [{ name: regex }, { email: regex }] })
        .limit(limit).select('name email role isActive'),

      Absence.find({ school: school._id })
        .populate('teacher', 'name')
        .then(abs => abs.filter(a => regex.test(a.teacher?.name) || regex.test(a.reason)).slice(0, limit)),

      GeneratedTimetable.find({ school: school._id, $or: [{ name: regex }] })
        .limit(limit).select('name status createdAt'),

      PeriodStructure.find({ school: school._id, $or: [{ name: regex }] })
        .limit(limit).select('name templateType status')
    ]);

    // Search classes with name/grade matching
    const allClasses = await Class.find({ school: school._id, isActive: true }).select('name grade section stream');
    const matchedClasses = allClasses.filter(c => regex.test(c.name) || regex.test(`${c.grade}-${c.section}`)).slice(0, limit);

    // Quick navigation pages
    const pages = [
      { name: 'Dashboard', path: '/', keywords: 'home overview stats' },
      { name: 'Teachers', path: '/teachers', keywords: 'teacher staff faculty' },
      { name: 'Classes', path: '/classes', keywords: 'class section grade' },
      { name: 'Subjects', path: '/subjects', keywords: 'subject course' },
      { name: 'Rooms', path: '/rooms', keywords: 'room lab hall' },
      { name: 'Weekly Subject Periods', path: '/requirements', keywords: 'requirement allocation period weekly' },
      { name: 'Timetable', path: '/timetable', keywords: 'timetable schedule view' },
      { name: 'Generator', path: '/generator', keywords: 'generate create auto' },
      { name: 'Absences', path: '/absences', keywords: 'absent leave absence' },
      { name: 'Substitutions', path: '/substitutions', keywords: 'substitute replace' },
      { name: 'Reports', path: '/reports', keywords: 'report export print' },
      { name: 'Audit Logs', path: '/audit-logs', keywords: 'audit log history' },
      { name: 'Settings', path: '/settings', keywords: 'settings preferences config' },
      { name: 'User Management', path: '/users', keywords: 'user account manage' },
      { name: 'Period Structure', path: '/periods', keywords: 'period timing slot bell' }
    ].filter(p => regex.test(p.name) || regex.test(p.keywords)).slice(0, 5);

    res.json({
      success: true,
      data: {
        pages: pages.map(p => ({ _id: p.path, name: p.name, path: p.path, type: 'page' })),
        teachers: teachers.map(t => ({ _id: t._id, name: t.name, email: t.email, department: t.department, shortName: t.shortName, status: t.status, type: 'teacher' })),
        classes: matchedClasses.map(c => ({ _id: c._id, name: c.name, grade: c.grade, section: c.section, stream: c.stream, type: 'class' })),
        subjects: subjects.map(s => ({ _id: s._id, name: s.name, code: s.code, color: s.color, type: 'subject' })),
        rooms: rooms.map(r => ({ _id: r._id, name: r.name, roomNumber: r.roomNumber, roomType: r.type, type: 'room' })),
        users: users.map(u => ({ _id: u._id, name: u.name, email: u.email, role: u.role, type: 'user' })),
        absences: absences.map(a => ({ _id: a._id, name: `${a.teacher?.name || 'Teacher'} - ${new Date(a.date).toLocaleDateString()}`, status: a.status, type: 'absence' })),
        timetables: timetables.map(t => ({ _id: t._id, name: t.name, status: t.status, type: 'timetable' })),
        periodStructures: periodStructures.map(p => ({ _id: p._id, name: p.name, templateType: p.templateType, type: 'periodStructure' }))
      }
    });
  } catch (err) { next(err); }
};
