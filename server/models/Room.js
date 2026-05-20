const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  name: { type: String, required: true, trim: true },
  roomNumber: { type: String, required: true, trim: true },
  type: { type: String, enum: ['classroom', 'lab', 'computer_lab', 'library', 'auditorium', 'playground', 'art_room', 'music_room', 'other'], default: 'classroom' },
  capacity: { type: Number, default: 40, min: 1 },
  floor: { type: Number, default: 0 },
  resources: [{ type: String, trim: true }], // "Projector", "Smart Board", "AC"
  unavailableSlots: [{
    day: { type: String, enum: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'] },
    periods: [Number]
  }],
  isAvailable: { type: Boolean, default: true }
}, { timestamps: true });

roomSchema.index({ school: 1, roomNumber: 1 }, { unique: true });

module.exports = mongoose.model('Room', roomSchema);
