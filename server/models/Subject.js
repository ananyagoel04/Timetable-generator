const mongoose = require('mongoose');

const subjectSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  session: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicSession', required: true },
  name: { type: String, required: true, trim: true },
  code: { type: String, required: true, uppercase: true, trim: true },
  shortName: { type: String, trim: true },
  type: { type: String, enum: ['theory', 'practical', 'lab', 'activity', 'library', 'games', 'moral_science', 'club', 'other'], default: 'theory' },
  category: { type: String, enum: ['core', 'elective', 'optional', 'co_curricular', 'extra_curricular'], default: 'core' },
  requiresLab: { type: Boolean, default: false },
  requiresSpecialRoom: { type: String, trim: true }, // "Computer Lab", "Physics Lab"
  defaultPeriodsPerWeek: { type: Number, default: 4, min: 1, max: 15 },
  canBeDoubled: { type: Boolean, default: false },     // Can have double periods
  preferMorning: { type: Boolean, default: false },    // Math/Science preference
  preferAfternoon: { type: Boolean, default: false },  // Activities/games preference
  maxPerDay: { type: Number, default: 2 },
  color: { type: String, default: '#6366f1' },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

subjectSchema.index({ school: 1, session: 1, code: 1 }, { unique: true });

module.exports = mongoose.model('Subject', subjectSchema);
