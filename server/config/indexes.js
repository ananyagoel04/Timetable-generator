/**
 * Database Compound Indexes — run once on server startup
 * Ensures optimal query performance for common access patterns
 */
const mongoose = require('mongoose');

async function ensureIndexes() {
  const startTime = Date.now();
  const results = [];

  try {
    // ── LessonBlock indexes ──
    const LessonBlock = mongoose.model('LessonBlock');
    await LessonBlock.collection.createIndex({ timetable: 1, day: 1, periods: 1 }, { background: true });
    await LessonBlock.collection.createIndex({ timetable: 1, teacher: 1 }, { background: true });
    await LessonBlock.collection.createIndex({ timetable: 1, classes: 1 }, { background: true });
    await LessonBlock.collection.createIndex({ timetable: 1, room: 1, day: 1, periods: 1 }, { background: true });
    await LessonBlock.collection.createIndex({ timetable: 1, teacher: 1, day: 1, periods: 1 }, { background: true });
    results.push('LessonBlock: 5 indexes');

    // ── ConflictLog indexes ──
    const ConflictLog = mongoose.model('ConflictLog');
    await ConflictLog.collection.createIndex({ timetable: 1, isResolved: 1 }, { background: true });
    await ConflictLog.collection.createIndex({ timetable: 1, severity: 1 }, { background: true });
    results.push('ConflictLog: 2 indexes');

    // ── AuditLog indexes ──
    const AuditLog = mongoose.model('AuditLog');
    await AuditLog.collection.createIndex({ school: 1, createdAt: -1 }, { background: true });
    await AuditLog.collection.createIndex({ performedBy: 1, createdAt: -1 }, { background: true });
    await AuditLog.collection.createIndex({ action: 1, entityType: 1 }, { background: true });
    results.push('AuditLog: 3 indexes');

    // ── Notification indexes ──
    try {
      const Notification = mongoose.model('Notification');
      await Notification.collection.createIndex({ user: 1, isRead: 1, createdAt: -1 }, { background: true });
      results.push('Notification: 1 index');
    } catch (e) { /* model may not exist */ }

    // ── Substitution indexes ──
    const Substitution = mongoose.model('Substitution');
    await Substitution.collection.createIndex({ school: 1, date: 1 }, { background: true });
    await Substitution.collection.createIndex({ originalTeacher: 1, date: 1 }, { background: true });
    await Substitution.collection.createIndex({ substituteTeacher: 1, date: 1 }, { background: true });
    results.push('Substitution: 3 indexes');

    // ── SubjectRequirement indexes ──
    const SubjectRequirement = mongoose.model('SubjectRequirement');
    await SubjectRequirement.collection.createIndex({ school: 1, session: 1, class: 1 }, { background: true });
    await SubjectRequirement.collection.createIndex({ school: 1, session: 1, subject: 1 }, { background: true });
    results.push('SubjectRequirement: 2 indexes');

    // ── CanTeach indexes ──
    const CanTeach = mongoose.model('CanTeach');
    await CanTeach.collection.createIndex({ school: 1, teacher: 1, subject: 1 }, { background: true, unique: true });
    results.push('CanTeach: 1 index');

    // ── GeneratedTimetable indexes ──
    const GeneratedTimetable = mongoose.model('GeneratedTimetable');
    await GeneratedTimetable.collection.createIndex({ school: 1, createdAt: -1 }, { background: true });
    results.push('GeneratedTimetable: 1 index');

    const elapsed = Date.now() - startTime;
    console.log(`📊 Database indexes ensured in ${elapsed}ms: ${results.join(', ')}`);
  } catch (err) {
    console.warn('⚠️  Index creation warning (non-fatal):', err.message);
  }
}

module.exports = ensureIndexes;
