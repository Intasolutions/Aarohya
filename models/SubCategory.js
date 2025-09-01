const mongoose = require('mongoose');
const SubCategorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  isBlocked: { type: Boolean, default: false }
}, { timestamps: true });
module.exports = mongoose.model('SubCategory', SubCategorySchema);