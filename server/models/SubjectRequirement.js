const mongoose = require('mongoose');

// Defines how many periods per week a specific class needs for a specific subject
const subjectRequirementSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  session: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicSession', required: true },
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
  periodsPerWeek: { type: Number, required: true, min: 1, max: 15 },
  preferredRoom: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
  // For student groups (e.g., Bio group gets Bio, Maths group gets Maths)
  studentGroup: { type: String, trim: true }, // null = whole class
  // Double period preferences
  allowDoublePeriod: { type: Boolean, default: false },
  doublePeriodsPerWeek: { type: Number, default: 0 },
  // Day preferences
  preferredDays: [{ type: String, enum: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'] }],
  avoidDays: [{ type: String, enum: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'] }],
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

subjectRequirementSchema.index({ school: 1, session: 1, class: 1, subject: 1, studentGroup: 1 });

module.exports = mongoose.model('SubjectRequirement', subjectRequirementSchema);
