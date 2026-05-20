const mongoose = require('mongoose');

const timeslotSchema = new mongoose.Schema({
  label: { type: String, required: true }, // "Period 1", "Lunch Break"
  slotNumber: { type: Number, required: true },
  startTime: { type: String, required: true }, // "08:00"
  endTime: { type: String, required: true },   // "08:40"
  type: { type: String, enum: ['period', 'break', 'lunch', 'assembly', 'custom'], default: 'period' },
  isSchedulable: { type: Boolean, default: true }
});

const periodStructureSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  session: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicSession', required: true },
  name: { type: String, default: 'Default', trim: true },
  workingDays: [{ type: String, enum: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'] }],
  timeslots: [timeslotSchema],
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('PeriodStructure', periodStructureSchema);
