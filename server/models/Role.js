const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  displayName: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  permissions: [{ type: String, trim: true }],
  // null = platform role, ObjectId = school-specific custom role
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', default: null },
  isSystem: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  category: {
    type: String,
    enum: ['platform', 'school_admin', 'school_staff', 'viewer', 'custom'],
    default: 'custom'
  },
  priority: { type: Number, default: 0 } // Higher = more authority
}, { timestamps: true });

// Compound index for school-level role lookup
roleSchema.index({ school: 1, name: 1 }, { unique: true });
roleSchema.index({ isSystem: 1 });

module.exports = mongoose.model('Role', roleSchema);
