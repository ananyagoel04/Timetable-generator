const mongoose = require('mongoose');

const absenceSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
  absenceType: { type: String, enum: ['full_day', 'selected_periods', 'date_range'], default: 'full_day' },
  date: { type: Date, required: true },
  endDate: { type: Date }, // for date_range
  affectedPeriods: [{ type: Number }], // for selected_periods
  reason: { type: String, trim: true, default: '' },
  status: { type: String, enum: ['pending', 'approved', 'rejected', 'adjusted'], default: 'pending' },
  // Auto-generated daily adjustment
  dailyAdjustment: { type: mongoose.Schema.Types.ObjectId, ref: 'DailyAdjustment' }
}, { timestamps: true });

module.exports = mongoose.model('Absence', absenceSchema);
