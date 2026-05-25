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
    const school = await School.findById(req.schoolId || (await School.findOne())?._id);
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
    const school = await School.findById(req.schoolId || (await School.findOne())?._id);
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
    const school = await School.findById(req.schoolId || (await School.findOne())?._id);
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

module.exports = router;
