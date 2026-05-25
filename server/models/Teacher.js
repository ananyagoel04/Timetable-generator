const mongoose = require('mongoose');

const teacherSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  session: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicSession', required: true },
  name: { type: String, required: true, trim: true },
  shortName: { type: String, trim: true },
  printAlias: { type: String, trim: true },
  employeeId: { type: String, trim: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  phone: { type: String, trim: true },
  department: { type: String, trim: true },
  designation: { type: String, trim: true },
  // Capabilities — which subjects can this teacher teach
  capabilities: [{
    subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
    proficiency: { type: String, enum: ['primary', 'secondary', 'backup'], default: 'primary' }
  }],
  // Scheduling constraints
  maxPeriodsPerDay: { type: Number, default: 6, min: 1, max: 10 },
  maxPeriodsPerWeek: { type: Number, default: 30, min: 1, max: 60 },
  maxContinuousPeriods: { type: Number, default: 4 },
  // Unavailability windows
  unavailableSlots: [{
    day: { type: String, enum: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'] },
    periods: [Number] // period numbers when teacher is unavailable
  }],
  color: { type: String, default: '#6366f1' },
  status: { type: String, enum: ['active', 'inactive', 'on_leave'], default: 'active' },
  joiningDate: { type: Date },
  leavingDate: { type: Date }
}, { timestamps: true });

teacherSchema.index({ school: 1, session: 1, email: 1 }, { unique: true });

module.exports = mongoose.model('Teacher', teacherSchema);
