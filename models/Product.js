const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    productName: { type: String, required: true },
    description: String,
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },
    subcategory: { type: mongoose.Schema.Types.ObjectId, ref: "SubCategory" },
    collections: [{ type: mongoose.Schema.Types.ObjectId, ref: "Collection" }],
    brandId: { type: mongoose.Schema.Types.ObjectId, ref: "Brand", },
    regularPrice: { type: Number, required: true },
    salePrice: { type: Number },
    quantity: { type: Number, default: 0 },
    productImage: [String],
    isBlocked: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);
 