const mongoose = require('mongoose');

const ruleVersionSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  session: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicSession' },
  ruleType: { type: String, enum: ['custom_rule', 'combination_rule', 'reserved_rule', 'soft_preference'], required: true },
  ruleId: { type: mongoose.Schema.Types.ObjectId, required: true },
  version: { type: Number, required: true, min: 1 },
  snapshot: { type: mongoose.Schema.Types.Mixed, required: true }, // Full rule data at this version
  changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  changedByName: { type: String },
  changeDescription: { type: String, trim: true },
  diff: { type: mongoose.Schema.Types.Mixed } // What changed
}, { timestamps: true });

ruleVersionSchema.index({ school: 1, ruleId: 1, version: -1 });
ruleVersionSchema.index({ ruleType: 1, ruleId: 1 });

module.exports = mongoose.model('RuleVersion', ruleVersionSchema);
