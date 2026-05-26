const mongoose = require('mongoose');

/**
 * StudentGroup — School-level student group definitions.
 * Represents sub-groups within a class (e.g., Bio Group, Maths Group in Class 11 Science).
 * Used by the split-group scheduler to create parallel block placements.
 */
const studentGroupSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  session: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicSession', required: true },
  name: { type: String, required: true, trim: true },     // "Bio Group"
  code: { type: String, required: true, uppercase: true, trim: true }, // "BIO"
  parentClass: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  // Subjects this group takes (electives)
  subjects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Subject' }],
  studentCount: { type: Number, default: 0, min: 0 },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

studentGroupSchema.index({ school: 1, session: 1, parentClass: 1, code: 1 }, { unique: true });
studentGroupSchema.index({ school: 1, session: 1, isActive: 1 });

module.exports = mongoose.model('StudentGroup', studentGroupSchema);
