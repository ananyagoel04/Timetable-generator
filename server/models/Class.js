const mongoose = require('mongoose');

const classSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  session: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicSession', required: true },
  name: { type: String, required: true, trim: true }, // "10-A"
  grade: { type: Number, required: true, min: 1, max: 12 },
  section: { type: String, required: true, uppercase: true, trim: true },
  stream: { type: String, enum: ['none', 'science', 'commerce', 'humanities', 'general'], default: 'none' },
  studentGroups: [{
    name: { type: String, trim: true },        // "Bio Group", "Maths Group"
    code: { type: String, uppercase: true },    // "BIO", "MATH"
    studentCount: { type: Number, default: 0 }
  }],
  classTeacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
  periodStructure: { type: mongoose.Schema.Types.ObjectId, ref: 'PeriodStructure' },
  shift: { type: String, enum: ['morning', 'afternoon', 'full_day'], default: 'full_day' },
  level: { type: String, enum: ['pre_primary', 'junior', 'middle', 'senior'] },
  studentCount: { type: Number, default: 30, min: 0 },
  roomPreference: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

classSchema.pre('validate', function(next) {
  if (this.grade && this.section) {
    const streamSuffix = this.stream !== 'none' ? ` (${this.stream})` : '';
    this.name = `${this.grade}-${this.section}${streamSuffix}`;
  }
  // Auto-compute level from grade
  if (this.grade && !this.level) {
    if (this.grade <= 5) this.level = 'junior';
    else if (this.grade <= 8) this.level = 'middle';
    else this.level = 'senior';
  }
  next();
});

classSchema.index({ school: 1, session: 1, grade: 1, section: 1 });

module.exports = mongoose.model('Class', classSchema);
