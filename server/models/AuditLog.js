const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School' },
  session: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicSession' },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userName: { type: String },
  userRole: { type: String },
  action: {
    type: String,
    enum: ['login', 'logout', 'failed_login', 'school_switch', 'session_switch',
           'create', 'update', 'delete', 'generate', 'regenerate', 'publish', 'unpublish',
           'manual_edit', 'move', 'swap', 'lock', 'unlock',
           'teacher_replacement', 'absence_create', 'substitution_approve', 'substitution_reject',
           'conflict_resolve', 'rule_change', 'period_change', 'subject_load_change',
           'room_change', 'rollback', 'export', 'import', 'permission_change', 'user_create',
           'user_update', 'seed_data',
           'manual_timetable_created', 'manual_lesson_added', 'manual_lesson_updated',
           'manual_lesson_deleted', 'manual_lesson_moved', 'manual_lesson_swapped',
           'manual_lesson_locked', 'manual_lesson_unlocked', 'manual_timetable_validated',
           'manual_timetable_published'],
    required: true
  },
  entityType: {
    type: String,
    enum: ['user', 'school', 'session', 'class', 'subject', 'teacher', 'room',
           'requirement', 'combination_rule', 'reserved_rule', 'custom_rule',
           'lesson_block', 'timetable', 'absence', 'substitution', 'replacement',
           'period_structure', 'conflict', 'system']
  },
  entityId: { type: mongoose.Schema.Types.ObjectId },
  entityName: { type: String },
  source: {
    type: String,
    enum: ['manual', 'auto', 'replacement', 'absence', 'rule_engine', 'admin_action',
           'system_action', 'api', 'seed'],
    default: 'manual'
  },
  // Change details
  oldValue: { type: mongoose.Schema.Types.Mixed },
  newValue: { type: mongoose.Schema.Types.Mixed },
  reason: { type: String, trim: true },
  // Affected entities
  affectedClass: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
  affectedTeacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
  affectedRoom: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
  affectedPeriod: { type: Number },
  affectedDay: { type: String },
  // Metadata
  ipAddress: { type: String },
  userAgent: { type: String },
  requestId: { type: String, trim: true },
  deviceType: { type: String, enum: ['desktop', 'mobile', 'tablet', 'api', 'system'], default: 'api' },
  sourceModule: { type: String, trim: true },
  isRollbackable: { type: Boolean, default: false },
  rolledBackAt: { type: Date },
  rolledBackBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

auditLogSchema.index({ school: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, entityType: 1 });
auditLogSchema.index({ user: 1, createdAt: -1 });
// Priority 4: production tracing indexes
auditLogSchema.index({ school: 1, action: 1, createdAt: -1 }); // action-filtered queries
auditLogSchema.index({ requestId: 1 }, { sparse: true }); // trace by request ID

module.exports = mongoose.model('AuditLog', auditLogSchema);
