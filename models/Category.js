const mongoose = require('mongoose');
const CategorySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  slug: { type: String, required: true, unique: true },
  isPrivate: { type: Boolean, default: false },
  isBlocked: { type: Boolean, default: false }
}, { timestamps: true });
module.exports = mongoose.model('Category', CategorySchema);