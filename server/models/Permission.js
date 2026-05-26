const mongoose = require('mongoose');

const permissionSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, trim: true },
  displayName: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  category: {
    type: String,
    enum: ['timetable', 'setup', 'staff', 'operations', 'reports', 'system', 'platform'],
    required: true
  },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

permissionSchema.index({ category: 1 });

module.exports = mongoose.model('Permission', permissionSchema);
