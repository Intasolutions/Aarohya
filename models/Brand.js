const mongoose = require('mongoose');
const BrandSchema = new mongoose.Schema({
  brandName: { type: String, required: true, unique: true },
  description: String,
  brandImage: [{ type: String, required: true }],
  isBlocked: { type: Boolean, default: false }
}, { timestamps: true });
module.exports = mongoose.model('Brand', BrandSchema);