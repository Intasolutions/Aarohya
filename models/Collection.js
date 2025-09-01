const mongoose = require('mongoose');
const CollectionSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  slug: { type: String, required: true, unique: true },
  isPrivate: { type: Boolean, default: true },
  isBlocked: { type: Boolean, default: false }
}, { timestamps: true });
module.exports = mongoose.model('Collection', CollectionSchema);