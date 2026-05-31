const mongoose = require('mongoose');

/**
 * ClassSubjectMapping — defines which subjects are taught in which class.
 * Separate from SubjectRequirement (which assigns teachers).
 * Allows: Games → classes 1-5 only, Physics → classes 9-12 only, etc.
 */
const classSubjectMappingSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  session: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicSession', required: true },
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },

  isActive: { type: Boolean, default: true },

  // Weekly load
  periodsPerWeek: { type: Number, default: 0, min: 0, max: 20 },
  minPeriods: { type: Number, min: 0, max: 20 },
  maxPeriods: { type: Number, min: 0, max: 20 },

  // Scheduling mode
  mode: { type: String, enum: ['strict', 'preferred', 'flexible'], default: 'preferred' },
  priority: { type: Number, default: 50, min: 1, max: 100 },

  // Period preferences
  preferredPeriods: [{ type: Number }],
  avoidedPeriods: [{ type: Number }],
  preferredDays: [{ type: String, enum: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'] }],
  avoidDays: [{ type: String, enum: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'] }],

  // Room & lab
  requiresLab: { type: Boolean, default: false },
  requiredRoomType: { type: String, trim: true },
  allowDoublePeriod: { type: Boolean, default: false },
  allowTripleLab: { type: Boolean, default: false },

  notes: { type: String, trim: true }
}, { timestamps: true });

classSubjectMappingSchema.index({ school: 1, session: 1, class: 1, subject: 1 }, { unique: true });
classSubjectMappingSchema.index({ school: 1, session: 1, class: 1 });

module.exports = mongoose.model('ClassSubjectMapping', classSubjectMappingSchema);
