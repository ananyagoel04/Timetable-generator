const mongoose = require('mongoose');

const schoolSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  code: { type: String, required: true, unique: true, uppercase: true },
  address: { type: String, trim: true },
  phone: { type: String, trim: true },
  email: { type: String, trim: true },
  logo: { type: String },
  settings: {
    defaultPeriodsPerDay: { type: Number, default: 8 },
    defaultBreakPeriod: { type: Number, default: 4 },
    workingDays: { type: [String], default: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'] },
    allowSaturdayActivities: { type: Boolean, default: true },
    maxTeacherContinuousPeriods: { type: Number, default: 4 },
    maxSameSubjectPerDay: { type: Number, default: 2 },
    classTeacherFirstPeriodPreference: { type: Boolean, default: true },
    activitiesPreferLaterPeriods: { type: Boolean, default: true },
    mathSciencePreferMorning: { type: Boolean, default: true }
  },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('School', schoolSchema);
