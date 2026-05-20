const mongoose = require('mongoose');

const academicSessionSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  name: { type: String, required: true, trim: true }, // e.g. "2025-26"
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  isCurrent: { type: Boolean, default: true },
  status: { type: String, enum: ['draft', 'active', 'archived'], default: 'draft' }
}, { timestamps: true });

module.exports = mongoose.model('AcademicSession', academicSessionSchema);
