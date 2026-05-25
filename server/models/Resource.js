const mongoose = require('mongoose');

const resourceSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  name: { type: String, required: true, trim: true }, // "Projector", "Smart Board", "Science Kit"
  type: { type: String, enum: ['equipment', 'software', 'material', 'vehicle', 'other'], default: 'equipment' },
  quantity: { type: Number, default: 1, min: 1 },
  // Which rooms have this resource
  assignedRooms: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Room' }],
  // Booking / availability
  isBookable: { type: Boolean, default: false },
  bookedBy: [{
    class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
    day: { type: String, enum: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'] },
    period: { type: Number }
  }],
  condition: { type: String, enum: ['good', 'fair', 'needs_repair', 'out_of_service'], default: 'good' },
  isAvailable: { type: Boolean, default: true }
}, { timestamps: true });

resourceSchema.index({ school: 1, type: 1 });

module.exports = mongoose.model('Resource', resourceSchema);
