const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    rating: { type: Number, min: 1, max: 5, required: true },
    comment: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    productName: { type: String, required: true },
    description: String,
    productNumber: { type: String, required: true }, 
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },
    subcategory: { type: mongoose.Schema.Types.ObjectId, ref: "SubCategory" },
    regularPrice: { type: Number, required: true },
    salePrice: { type: Number },
    quantity: { type: Number, default: 0 },
    productImage: [String],
    color: {
      type: String,
      enum: ["Silver", "Gold", "Rose Gold"],
      required: true
    },
    isBlocked: { type: Boolean, default: false },

    reviews: [reviewSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);
