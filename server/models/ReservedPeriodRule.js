const mongoose = require('mongoose');

const reservedPeriodRuleSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  session: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicSession', required: true },
  name: { type: String, required: true, trim: true }, // "Saturday Activity Period"
  type: { type: String, enum: ['assembly', 'prayer', 'activity', 'library', 'games', 'club', 'supervised_study', 'custom'], required: true },
  appliesTo: [{
    class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' }
  }], // empty = all classes
  day: { type: String, enum: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'], required: true },
  periods: [{ type: Number, required: true }],
  subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' }, // optional linked subject
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' }, // optional
  room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
  isLocked: { type: Boolean, default: true },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

reservedPeriodRuleSchema.index({ school: 1, session: 1, isActive: 1, day: 1 });

module.exports = mongoose.model('ReservedPeriodRule', reservedPeriodRuleSchema);
