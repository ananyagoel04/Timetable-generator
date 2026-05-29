/**
 * Database Compound Indexes — run once on server startup
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Ensures optimal query performance for common access patterns.
 * All indexes use { background: true } to avoid blocking writes.
 *
 * Priority 4: Added school-scoped compound indexes for production
 * tenant isolation and clash detection performance.
 */
const mongoose = require('mongoose');

async function ensureIndexes() {
  const startTime = Date.now();
  const results = [];

  try {
    // ── LessonBlock indexes ──
    // Core scheduling indexes (timetable-scoped)
    const LessonBlock = mongoose.model('LessonBlock');
    await LessonBlock.collection.createIndex(
      { timetable: 1, day: 1, periods: 1 },
      { background: true, name: 'lb_timetable_day_periods' }
    );
    await LessonBlock.collection.createIndex(
      { timetable: 1, teacher: 1 },
      { background: true, name: 'lb_timetable_teacher' }
    );
    await LessonBlock.collection.createIndex(
      { timetable: 1, classes: 1 },
      { background: true, name: 'lb_timetable_classes' }
    );
    await LessonBlock.collection.createIndex(
      { timetable: 1, room: 1, day: 1, periods: 1 },
      { background: true, name: 'lb_timetable_room_day_periods' }
    );
    await LessonBlock.collection.createIndex(
      { timetable: 1, teacher: 1, day: 1, periods: 1 },
      { background: true, name: 'lb_timetable_teacher_day_periods' }
    );
    // Priority 4: school-scoped for production tenant isolation
    await LessonBlock.collection.createIndex(
      { school: 1, timetable: 1, teacher: 1, day: 1, periods: 1 },
      { background: true, name: 'lb_school_tt_teacher_clash' }
    );
    await LessonBlock.collection.createIndex(
      { school: 1, timetable: 1, room: 1, day: 1, periods: 1 },
      { background: true, name: 'lb_school_tt_room_clash' }
    );
    await LessonBlock.collection.createIndex(
      { school: 1, timetable: 1, classes: 1, day: 1, periods: 1 },
      { background: true, name: 'lb_school_tt_class_clash' }
    );
    // Block type filtering (for activity/club/lab queries)
    await LessonBlock.collection.createIndex(
      { timetable: 1, type: 1 },
      { background: true, name: 'lb_timetable_type' }
    );
    results.push('LessonBlock: 9 indexes');

    // ── ConflictLog indexes ──
    const ConflictLog = mongoose.model('ConflictLog');
    await ConflictLog.collection.createIndex(
      { timetable: 1, isResolved: 1 },
      { background: true, name: 'cl_timetable_resolved' }
    );
    await ConflictLog.collection.createIndex(
      { timetable: 1, severity: 1 },
      { background: true, name: 'cl_timetable_severity' }
    );
    // Priority 4: school-scoped for multi-tenant conflict queries
    await ConflictLog.collection.createIndex(
      { timetable: 1, type: 1 },
      { background: true, name: 'cl_timetable_type' }
    );
    results.push('ConflictLog: 3 indexes');

    // ── AuditLog indexes ──
    const AuditLog = mongoose.model('AuditLog');
    await AuditLog.collection.createIndex(
      { school: 1, createdAt: -1 },
      { background: true, name: 'al_school_created' }
    );
    await AuditLog.collection.createIndex(
      { user: 1, createdAt: -1 },
      { background: true, name: 'al_user_created' }
    );
    await AuditLog.collection.createIndex(
      { action: 1, entityType: 1 },
      { background: true, name: 'al_action_entity' }
    );
    // Priority 4: production tracing indexes
    await AuditLog.collection.createIndex(
      { school: 1, action: 1, createdAt: -1 },
      { background: true, name: 'al_school_action_created' }
    );
    await AuditLog.collection.createIndex(
      { school: 1, user: 1, createdAt: -1 },
      { background: true, name: 'al_school_user_created' }
    );
    await AuditLog.collection.createIndex(
      { requestId: 1 },
      { background: true, sparse: true, name: 'al_request_id' }
    );
    results.push('AuditLog: 6 indexes');

    // ── Notification indexes ──
    try {
      const Notification = mongoose.model('Notification');
      await Notification.collection.createIndex(
        { user: 1, isRead: 1, createdAt: -1 },
        { background: true, name: 'notif_user_read_created' }
      );
      results.push('Notification: 1 index');
    } catch (e) { /* model may not exist */ }

    // ── Substitution indexes ──
    const Substitution = mongoose.model('Substitution');
    await Substitution.collection.createIndex(
      { school: 1, date: 1 },
      { background: true, name: 'sub_school_date' }
    );
    await Substitution.collection.createIndex(
      { originalTeacher: 1, date: 1 },
      { background: true, name: 'sub_orig_teacher_date' }
    );
    await Substitution.collection.createIndex(
      { substituteTeacher: 1, date: 1 },
      { background: true, name: 'sub_sub_teacher_date' }
    );
    results.push('Substitution: 3 indexes');

    // ── SubjectRequirement indexes ──
    const SubjectRequirement = mongoose.model('SubjectRequirement');
    await SubjectRequirement.collection.createIndex(
      { school: 1, session: 1, class: 1 },
      { background: true, name: 'sr_school_session_class' }
    );
    await SubjectRequirement.collection.createIndex(
      { school: 1, session: 1, subject: 1 },
      { background: true, name: 'sr_school_session_subject' }
    );
    results.push('SubjectRequirement: 2 indexes');

    // ── CanTeach indexes ──
    const CanTeach = mongoose.model('CanTeach');
    await CanTeach.collection.createIndex(
      { school: 1, teacher: 1, subject: 1 },
      { background: true, unique: true, name: 'ct_school_teacher_subject' }
    );
    results.push('CanTeach: 1 index');

    // ── GeneratedTimetable indexes ──
    const GeneratedTimetable = mongoose.model('GeneratedTimetable');
    await GeneratedTimetable.collection.createIndex(
      { school: 1, createdAt: -1 },
      { background: true, name: 'gt_school_created' }
    );
    await GeneratedTimetable.collection.createIndex(
      { school: 1, session: 1, status: 1, createdAt: -1 },
      { background: true, name: 'gt_school_session_status_created' }
    );
    results.push('GeneratedTimetable: 2 indexes');

    // ── TimetableSnapshot indexes ──
    try {
      const TimetableSnapshot = mongoose.model('TimetableSnapshot');
      await TimetableSnapshot.collection.createIndex(
        { timetable: 1, version: -1 },
        { background: true, name: 'snap_timetable_version' }
      );
      await TimetableSnapshot.collection.createIndex(
        { school: 1, createdAt: -1 },
        { background: true, name: 'snap_school_created' }
      );
      results.push('TimetableSnapshot: 2 indexes');
    } catch (e) { /* model may not exist */ }

    const elapsed = Date.now() - startTime;
    console.log(`📊 Database indexes ensured in ${elapsed}ms: ${results.join(', ')}`);
  } catch (err) {
    console.warn('⚠️  Index creation warning (non-fatal):', err.message);
  }
}

module.exports = ensureIndexes;
