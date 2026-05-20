const mongoose = require('mongoose');

const timeslotSchema = new mongoose.Schema({
  label: { type: String, required: true },
  slotNumber: { type: Number, required: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  type: { type: String, enum: ['period', 'break', 'lunch', 'assembly', 'activity', 'custom'], default: 'period' },
  isSchedulable: { type: Boolean, default: true }
});

const periodStructureSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  session: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicSession', required: true },
  name: { type: String, default: 'Default', trim: true },
  description: { type: String, trim: true },
  templateType: {
    type: String,
    enum: ['default', 'junior', 'senior', 'half_day', 'exam', 'saturday', 'event', 'remedial', 'custom'],
    default: 'default'
  },
  // Assignment scope
  assignedTo: {
    classes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Class' }],
    grades: [{ type: Number }],
    streams: [{ type: String }],
    shifts: [{ type: String }]
  },
  // Validity
  effectiveFrom: { type: Date },
  effectiveTo: { type: Date },
  // Versioning
  version: { type: Number, default: 1 },
  clonedFrom: { type: mongoose.Schema.Types.ObjectId, ref: 'PeriodStructure' },
  isTemplate: { type: Boolean, default: false },
  status: { type: String, enum: ['draft', 'active', 'archived'], default: 'active' },
  // Schedule
  workingDays: [{ type: String, enum: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'] }],
  timeslots: [timeslotSchema],
  // Saturday-specific config
  saturdayConfig: {
    enabled: { type: Boolean, default: false },
    timeslots: [timeslotSchema]
  },
  // Per-day overrides (e.g. shortened Wednesday)
  dayOverrides: [{
    day: { type: String, enum: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'] },
    timeslots: [timeslotSchema]
  }],
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

periodStructureSchema.index({ school: 1, session: 1, status: 1 });
periodStructureSchema.index({ 'assignedTo.classes': 1 });
periodStructureSchema.index({ 'assignedTo.grades': 1 });

module.exports = mongoose.model('PeriodStructure', periodStructureSchema);
