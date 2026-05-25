const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  session: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicSession' },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: {
    type: String,
    enum: [
      'timetable_published', 'conflict_detected', 'absence_created',
      'replacement_needed', 'substitution_assigned', 'timetable_edited',
      'rule_changed', 'system_alert', 'audit_alert'
    ],
    required: true
  },
  title: { type: String, required: true, trim: true },
  message: { type: String, trim: true },
  severity: {
    type: String,
    enum: ['info', 'warning', 'error', 'success'],
    default: 'info'
  },
  relatedEntity: {
    entityType: { type: String },
    entityId: { type: mongoose.Schema.Types.ObjectId }
  },
  isRead: { type: Boolean, default: false },
  readAt: { type: Date },
  actionUrl: { type: String },
  expiresAt: { type: Date }
}, { timestamps: true });

notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ school: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
