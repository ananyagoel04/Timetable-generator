const router = require('express').Router();
const { authorize } = require('../middleware/auth');
const ExcelJS = require('exceljs');
const LessonBlock = require('../models/LessonBlock');
const GeneratedTimetable = require('../models/GeneratedTimetable');
const Teacher = require('../models/Teacher');
const Class = require('../models/Class');
const Subject = require('../models/Subject');
const Room = require('../models/Room');
const School = require('../models/School');
const Substitution = require('../models/Substitution');

// GET /api/export/timetable/excel?timetableId=...&viewType=class|teacher|room
router.get('/timetable/excel', authorize('export_reports'), async (req, res, next) => {
  try {
    const { timetableId, viewType = 'class' } = req.query;
    const school = await School.findById(req.schoolId);
    if (!school) return res.status(404).json({ success: false, error: 'School not found' });

    const tt = timetableId
      ? await GeneratedTimetable.findById(timetableId)
      : await GeneratedTimetable.findOne({ school: school._id }).sort({ createdAt: -1 });
    if (!tt) return res.status(404).json({ success: false, error: 'No timetable found' });

    const blocks = await LessonBlock.find({ timetable: tt._id })
      .populate('subject teacher room classes');

    const workingDays = school.settings?.workingDays || ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const totalPeriods = school.settings?.defaultPeriodsPerDay || 8;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'TimeCraft ERP';
    workbook.created = new Date();

    if (viewType === 'class') {
      const classes = await Class.find({ school: school._id, isActive: true }).sort({ grade: 1, section: 1 });
      const usedNames = new Set();
      for (const cls of classes) {
        let sheetName = cls.name.substring(0, 31);
        // Ensure unique worksheet names (Excel requires unique sheet names)
        if (usedNames.has(sheetName)) {
          let counter = 2;
          while (usedNames.has(`${sheetName.substring(0, 28)}_${counter}`)) counter++;
          sheetName = `${sheetName.substring(0, 28)}_${counter}`;
        }
        usedNames.add(sheetName);
        const sheet = workbook.addWorksheet(sheetName);
        _buildTimetableSheet(sheet, blocks, workingDays, totalPeriods, 'class', cls._id.toString(), cls.name);
      }
    } else if (viewType === 'teacher') {
      const teachers = await Teacher.find({ school: school._id, status: 'active' }).sort({ name: 1 });
      const usedNames = new Set();
      for (const t of teachers) {
        let sheetName = (t.shortName || t.name).substring(0, 31);
        if (usedNames.has(sheetName)) {
          let counter = 2;
          while (usedNames.has(`${sheetName.substring(0, 28)}_${counter}`)) counter++;
          sheetName = `${sheetName.substring(0, 28)}_${counter}`;
        }
        usedNames.add(sheetName);
        const sheet = workbook.addWorksheet(sheetName);
        _buildTimetableSheet(sheet, blocks, workingDays, totalPeriods, 'teacher', t._id.toString(), t.name);
      }
    } else if (viewType === 'room') {
      const rooms = await Room.find({ school: school._id, isAvailable: true }).sort({ name: 1 });
      const usedNames = new Set();
      for (const r of rooms) {
        let sheetName = r.name.substring(0, 31);
        if (usedNames.has(sheetName)) {
          let counter = 2;
          while (usedNames.has(`${sheetName.substring(0, 28)}_${counter}`)) counter++;
          sheetName = `${sheetName.substring(0, 28)}_${counter}`;
        }
        usedNames.add(sheetName);
        const sheet = workbook.addWorksheet(sheetName);
        _buildTimetableSheet(sheet, blocks, workingDays, totalPeriods, 'room', r._id.toString(), r.name);
      }
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=timetable_${viewType}_${Date.now()}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) { next(err); }
});

// GET /api/export/substitutions/excel?from=...&to=...
router.get('/substitutions/excel', authorize('export_reports'), async (req, res, next) => {
  try {
    const school = await School.findById(req.schoolId);
    const { from, to } = req.query;
    const query = { school: school._id };
    if (from || to) {
      query.date = {};
      if (from) query.date.$gte = new Date(from);
      if (to) query.date.$lte = new Date(to);
    }
    const subs = await Substitution.find(query)
      .populate('originalTeacher substituteTeacher class subject')
      .sort({ date: -1 });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Substitutions');
    sheet.columns = [
      { header: 'Date', key: 'date', width: 14 },
      { header: 'Period', key: 'period', width: 8 },
      { header: 'Class', key: 'class', width: 12 },
      { header: 'Subject', key: 'subject', width: 16 },
      { header: 'Original Teacher', key: 'original', width: 20 },
      { header: 'Substitute Teacher', key: 'substitute', width: 20 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Notes', key: 'notes', width: 24 },
    ];
    // Style header
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4338CA' } };

    for (const s of subs) {
      sheet.addRow({
        date: s.date?.toISOString().split('T')[0] || '',
        period: s.period,
        class: s.class?.name || '',
        subject: s.subject?.name || '',
        original: s.originalTeacher?.name || '',
        substitute: s.substituteTeacher?.name || '',
        status: s.status,
        notes: s.notes || '',
      });
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=substitutions_${Date.now()}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) { next(err); }
});

// GET /api/export/workload/excel
router.get('/workload/excel', authorize('export_reports'), async (req, res, next) => {
  try {
    const school = await School.findById(req.schoolId);
    const tt = await GeneratedTimetable.findOne({ school: school._id }).sort({ createdAt: -1 });
    if (!tt) return res.status(404).json({ success: false, error: 'No timetable found' });

    const blocks = await LessonBlock.find({ timetable: tt._id, teacher: { $ne: null } })
      .populate('teacher subject');
    const teachers = await Teacher.find({ school: school._id, status: 'active' }).sort({ name: 1 });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Teacher Workload');
    sheet.columns = [
      { header: 'Teacher', key: 'teacher', width: 22 },
      { header: 'Department', key: 'dept', width: 16 },
      { header: 'Max/Day', key: 'maxDay', width: 10 },
      { header: 'Max/Week', key: 'maxWeek', width: 10 },
      { header: 'Mon', key: 'mon', width: 6 },
      { header: 'Tue', key: 'tue', width: 6 },
      { header: 'Wed', key: 'wed', width: 6 },
      { header: 'Thu', key: 'thu', width: 6 },
      { header: 'Fri', key: 'fri', width: 6 },
      { header: 'Sat', key: 'sat', width: 6 },
      { header: 'Total', key: 'total', width: 8 },
      { header: 'Load %', key: 'load', width: 10 },
    ];
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4338CA' } };

    for (const t of teachers) {
      const tBlocks = blocks.filter(b => b.teacher?._id.toString() === t._id.toString());
      const dayCount = {};
      for (const b of tBlocks) {
        dayCount[b.day] = (dayCount[b.day] || 0) + b.periods.length;
      }
      const total = Object.values(dayCount).reduce((s, v) => s + v, 0);
      sheet.addRow({
        teacher: t.name, dept: t.department || '',
        maxDay: t.maxPeriodsPerDay, maxWeek: t.maxPeriodsPerWeek,
        mon: dayCount['Monday'] || 0, tue: dayCount['Tuesday'] || 0,
        wed: dayCount['Wednesday'] || 0, thu: dayCount['Thursday'] || 0,
        fri: dayCount['Friday'] || 0, sat: dayCount['Saturday'] || 0,
        total, load: `${Math.round((total / t.maxPeriodsPerWeek) * 100)}%`
      });
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=workload_${Date.now()}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) { next(err); }
});

function _buildTimetableSheet(sheet, blocks, days, totalPeriods, filterType, filterId, title) {
  sheet.mergeCells(1, 1, 1, days.length + 1);
  sheet.getCell('A1').value = title;
  sheet.getCell('A1').font = { bold: true, size: 14 };
  sheet.getCell('A1').alignment = { horizontal: 'center' };

  // Header row
  const headerRow = sheet.getRow(2);
  headerRow.getCell(1).value = 'Period';
  headerRow.getCell(1).font = { bold: true };
  days.forEach((d, i) => {
    headerRow.getCell(i + 2).value = d;
    headerRow.getCell(i + 2).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.getCell(i + 2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4338CA' } };
    sheet.getColumn(i + 2).width = 22;
  });
  sheet.getColumn(1).width = 10;

  for (let p = 1; p <= totalPeriods; p++) {
    const row = sheet.getRow(p + 2);
    row.getCell(1).value = `P${p}`;
    row.getCell(1).font = { bold: true };
    for (let di = 0; di < days.length; di++) {
      const day = days[di];
      const matching = blocks.filter(b => {
        if (b.day !== day || !b.periods.includes(p)) return false;
        if (filterType === 'class') return b.classes?.some(c => (c._id || c).toString() === filterId);
        if (filterType === 'teacher') return b.teacher && (b.teacher._id || b.teacher).toString() === filterId;
        if (filterType === 'room') return b.room && (b.room._id || b.room).toString() === filterId;
        return false;
      });
      if (matching.length > 0) {
        const b = matching[0];
        const parts = [];
        if (b.subject?.name) parts.push(b.subject.name);
        if (filterType !== 'teacher' && b.teacher?.name) parts.push(b.teacher.shortName || b.teacher.name);
        if (filterType !== 'room' && b.room?.name) parts.push(b.room.name);
        if (filterType !== 'class' && b.classes?.length) parts.push(b.classes.map(c => c.name || c).join('+'));
        row.getCell(di + 2).value = parts.join(' | ');
      } else {
        row.getCell(di + 2).value = '';
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
// PDF EXPORTS
// ═══════════════════════════════════════════════════════════════════
const PDFExporter = require('../services/pdfExporter');
const AcademicSession = require('../models/AcademicSession');
const PeriodStructure = require('../models/PeriodStructure');

async function _getPdfScope(req) {
  const school = await School.findById(req.schoolId);
  const session = await AcademicSession.findOne({ school: school?._id, isCurrent: true });
  const ps = await PeriodStructure.findOne({ school: school?._id, status: 'active' });
  const workingDays = school?.settings?.workingDays || ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const totalPeriods = ps ? ps.timeslots.filter(t => t.isSchedulable).length : (school?.settings?.defaultPeriodsPerDay || 8);
  return { school, session, workingDays, totalPeriods };
}

// GET /api/export/timetable/pdf?timetableId=...&classId=...
router.get('/timetable/pdf', authorize('export_reports'), async (req, res, next) => {
  try {
    const { timetableId, classId } = req.query;
    const { school, session, workingDays, totalPeriods } = await _getPdfScope(req);

    const tt = timetableId
      ? await GeneratedTimetable.findById(timetableId)
      : await GeneratedTimetable.findOne({ school: school._id }).sort({ createdAt: -1 });
    if (!tt) return res.status(404).json({ success: false, error: 'No timetable found' });

    const pdf = new PDFExporter(school, session);

    if (classId) {
      const cls = await Class.findById(classId);
      if (!cls) return res.status(404).json({ success: false, error: 'Class not found' });
      const blocks = await LessonBlock.find({ timetable: tt._id, classes: classId })
        .populate('subject teacher room');
      const buf = pdf.generateClassTimetable(cls, blocks, workingDays, totalPeriods);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=timetable_${cls.name}_${Date.now()}.pdf`);
      return res.send(Buffer.from(buf));
    }

    // Full school PDF
    const classes = await Class.find({ school: school._id, isActive: true }).sort({ grade: 1, section: 1 });
    const blocks = await LessonBlock.find({ timetable: tt._id }).populate('subject teacher room classes');
    const classReports = classes.map(cls => {
      const classBlocks = blocks.filter(b => b.classes.some(c => (c._id || c).toString() === cls._id.toString()));
      const schedule = {};
      classBlocks.forEach(b => {
        if (!schedule[b.day]) schedule[b.day] = [];
        schedule[b.day].push({ period: b.periods[0], subject: b.subject?.name, teacher: b.teacher?.shortName || b.teacher?.name, room: b.room?.name });
      });
      return { class: { name: cls.name }, schedule };
    });
    const buf = pdf.generateFullSchoolPDF(classReports, workingDays, totalPeriods);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=full_school_timetable_${Date.now()}.pdf`);
    res.send(Buffer.from(buf));
  } catch (err) { next(err); }
});

// GET /api/export/timetable/teacher-pdf?timetableId=...&teacherId=...
router.get('/timetable/teacher-pdf', authorize('export_reports'), async (req, res, next) => {
  try {
    const { timetableId, teacherId } = req.query;
    if (!teacherId) return res.status(400).json({ success: false, error: 'teacherId required' });
    const { school, session, workingDays, totalPeriods } = await _getPdfScope(req);
    const tt = timetableId
      ? await GeneratedTimetable.findById(timetableId)
      : await GeneratedTimetable.findOne({ school: school._id }).sort({ createdAt: -1 });
    if (!tt) return res.status(404).json({ success: false, error: 'No timetable found' });

    const teacher = await Teacher.findById(teacherId);
    if (!teacher) return res.status(404).json({ success: false, error: 'Teacher not found' });
    const blocks = await LessonBlock.find({ timetable: tt._id, teacher: teacherId }).populate('subject room classes');

    const pdf = new PDFExporter(school, session);
    const buf = pdf.generateTeacherTimetable(teacher, blocks, workingDays, totalPeriods);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=timetable_${teacher.shortName || teacher.name}_${Date.now()}.pdf`);
    res.send(Buffer.from(buf));
  } catch (err) { next(err); }
});

// GET /api/export/daily-sheet/pdf?date=...
router.get('/daily-sheet/pdf', authorize('export_reports'), async (req, res, next) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ success: false, error: 'date required' });
    const { school, session } = await _getPdfScope(req);

    const Absence = require('../models/Absence');
    const startDate = new Date(date); startDate.setHours(0,0,0,0);
    const endDate = new Date(date); endDate.setHours(23,59,59,999);

    const [subs, absences] = await Promise.all([
      Substitution.find({ school: school._id, date: { $gte: startDate, $lte: endDate } })
        .populate('originalTeacher substituteTeacher class subject').sort({ period: 1 }),
      Absence.find({ school: school._id, date: { $gte: startDate, $lte: endDate } })
        .populate('teacher')
    ]);

    const pdf = new PDFExporter(school, session);
    const buf = pdf.generateDailySheet(date, subs, absences);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=daily_sheet_${date}_${Date.now()}.pdf`);
    res.send(Buffer.from(buf));
  } catch (err) { next(err); }
});

// GET /api/export/workload/pdf
router.get('/workload/pdf', authorize('export_reports'), async (req, res, next) => {
  try {
    const { school, session } = await _getPdfScope(req);
    const tt = await GeneratedTimetable.findOne({ school: school._id }).sort({ createdAt: -1 });
    if (!tt) return res.status(404).json({ success: false, error: 'No timetable found' });

    const teachers = await Teacher.find({ school: school._id, status: 'active' }).sort({ name: 1 });
    const blocks = await LessonBlock.find({ timetable: tt._id, teacher: { $ne: null }, type: { $nin: ['reserved'] } })
      .populate('subject classes');

    const workloadData = teachers.map(t => {
      const tBlocks = blocks.filter(b => b.teacher.toString() === t._id.toString());
      const dayLoads = {};
      for (const b of tBlocks) { dayLoads[b.day] = (dayLoads[b.day] || 0) + b.periods.length; }
      const totalPeriods = Object.values(dayLoads).reduce((s, v) => s + v, 0);
      const utilization = t.maxPeriodsPerWeek > 0 ? Math.round((totalPeriods / t.maxPeriodsPerWeek) * 100) : 0;
      return {
        teacher: { name: t.name, department: t.department },
        maxPerDay: t.maxPeriodsPerDay, maxPerWeek: t.maxPeriodsPerWeek,
        totalPeriods, utilization, dayLoads,
        status: utilization > 100 ? 'OVER' : utilization > 80 ? 'optimal' : utilization > 50 ? 'moderate' : 'under'
      };
    });

    const pdf = new PDFExporter(school, session);
    const buf = pdf.generateWorkloadReport(workloadData);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=workload_${Date.now()}.pdf`);
    res.send(Buffer.from(buf));
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════════════
// ROOM TIMETABLE PDF
// ═══════════════════════════════════════════════════════════════
router.get('/timetable/room-pdf', authorize('export_reports'), async (req, res, next) => {
  try {
    const { timetableId, roomId } = req.query;
    if (!roomId) return res.status(400).json({ success: false, error: 'roomId required' });
    const { school, session, workingDays, totalPeriods } = await _getPdfScope(req);
    const tt = timetableId
      ? await GeneratedTimetable.findById(timetableId)
      : await GeneratedTimetable.findOne({ school: school._id }).sort({ createdAt: -1 });
    if (!tt) return res.status(404).json({ success: false, error: 'No timetable found' });

    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ success: false, error: 'Room not found' });
    const blocks = await LessonBlock.find({ timetable: tt._id, room: roomId }).populate('subject teacher classes');

    const pdf = new PDFExporter(school, session);
    const buf = pdf.generateRoomTimetable(room, blocks, workingDays, totalPeriods);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=room_${room.name}_${Date.now()}.pdf`);
    res.send(Buffer.from(buf));
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════════════
// CONFLICT EXCEL EXPORT
// ═══════════════════════════════════════════════════════════════
router.get('/conflicts/excel', authorize('export_reports'), async (req, res, next) => {
  try {
    const school = await School.findById(req.schoolId);
    const tt = await GeneratedTimetable.findOne({ school: school._id }).sort({ createdAt: -1 });
    if (!tt) return res.status(404).json({ success: false, error: 'No timetable found' });

    const ConflictLog = require('../models/ConflictLog');
    const conflicts = await ConflictLog.find({ timetable: tt._id }).sort({ severity: -1, createdAt: -1 });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Conflicts');
    sheet.columns = [
      { header: 'Type', key: 'type', width: 20 },
      { header: 'Severity', key: 'severity', width: 12 },
      { header: 'Day', key: 'day', width: 12 },
      { header: 'Period', key: 'period', width: 8 },
      { header: 'Description', key: 'description', width: 40 },
      { header: 'Resolved', key: 'resolved', width: 10 },
      { header: 'Resolution', key: 'resolution', width: 30 },
      { header: 'Created', key: 'created', width: 16 },
    ];
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDC2626' } };

    for (const c of conflicts) {
      sheet.addRow({
        type: c.type || '', severity: c.severity || '',
        day: c.day || '', period: c.period || '',
        description: c.description || c.message || '',
        resolved: c.isResolved ? 'Yes' : 'No',
        resolution: c.resolution || '',
        created: c.createdAt?.toISOString().split('T')[0] || ''
      });
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=conflicts_${Date.now()}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════════════
// AUDIT LOG EXCEL EXPORT
// ═══════════════════════════════════════════════════════════════
router.get('/audit/excel', authorize('view_audit', 'export_reports'), async (req, res, next) => {
  try {
    let AuditLogModel;
    try { AuditLogModel = require('../models/AuditLog'); } catch(e) {
      return res.status(404).json({ success: false, error: 'AuditLog model not available' });
    }

    const school = await School.findById(req.schoolId);
    const { from, to, module: mod } = req.query;
    const filter = { school: school._id };
    if (mod) filter.module = mod;
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) { const d = new Date(to); d.setHours(23,59,59,999); filter.createdAt.$lte = d; }
    }

    const logs = await AuditLogModel.find(filter).sort({ createdAt: -1 }).limit(1000)
      .populate('user', 'name email role');

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Audit Logs');
    sheet.columns = [
      { header: 'Date', key: 'date', width: 18 },
      { header: 'User', key: 'user', width: 22 },
      { header: 'Role', key: 'role', width: 16 },
      { header: 'Action', key: 'action', width: 22 },
      { header: 'Module', key: 'module', width: 16 },
      { header: 'Details', key: 'details', width: 40 },
      { header: 'IP', key: 'ip', width: 16 },
    ];
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4338CA' } };

    for (const l of logs) {
      sheet.addRow({
        date: l.createdAt?.toISOString().replace('T', ' ').slice(0, 19) || '',
        user: l.user?.name || l.userName || '',
        role: l.user?.role || l.userRole || '',
        action: l.action || '',
        module: l.module || '',
        details: typeof l.details === 'string' ? l.details : JSON.stringify(l.details || '').slice(0, 200),
        ip: l.ipAddress || l.ip || ''
      });
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=audit_${Date.now()}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════════════
// ROOM UTILIZATION EXCEL EXPORT
// ═══════════════════════════════════════════════════════════════
router.get('/room-utilization/excel', authorize('export_reports'), async (req, res, next) => {
  try {
    const school = await School.findById(req.schoolId);
    const tt = await GeneratedTimetable.findOne({ school: school._id }).sort({ createdAt: -1 });
    if (!tt) return res.status(404).json({ success: false, error: 'No timetable found' });

    const rooms = await Room.find({ school: school._id }).sort({ name: 1 });
    const blocks = await LessonBlock.find({ timetable: tt._id, room: { $ne: null } });
    const workingDays = school?.settings?.workingDays || ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const periodsPerDay = school?.settings?.defaultPeriodsPerDay || 8;
    const totalSlots = workingDays.length * periodsPerDay;

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Room Utilization');
    sheet.columns = [
      { header: 'Room', key: 'room', width: 20 },
      { header: 'Type', key: 'type', width: 14 },
      { header: 'Capacity', key: 'capacity', width: 10 },
      { header: 'Used Slots', key: 'used', width: 12 },
      { header: 'Total Slots', key: 'total', width: 12 },
      { header: 'Utilization %', key: 'util', width: 14 },
      { header: 'Status', key: 'status', width: 12 },
    ];
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4338CA' } };

    for (const r of rooms) {
      const used = blocks.filter(b => b.room.toString() === r._id.toString()).reduce((s, b) => s + b.periods.length, 0);
      const util = totalSlots > 0 ? Math.round((used / totalSlots) * 100) : 0;
      sheet.addRow({
        room: r.name, type: r.type, capacity: r.capacity,
        used, total: totalSlots, util: `${util}%`,
        status: util > 80 ? 'High' : util > 40 ? 'Moderate' : 'Low'
      });
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=room_utilization_${Date.now()}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) { next(err); }
});

module.exports = router;
