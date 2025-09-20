const mongoose = require("mongoose");
const { Schema } = mongoose;

const cartSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    items: [
      {
        productId: {
          type: Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        quantity: {
          type: Number,
          default: 1,
          min: 1,
        },
        selectedColor: {
          type: String,
          enum: ["Silver", "Gold", "Rose Gold",'none'],
          required: false,
        },

        // Snapshot (to avoid issues if product updates later)
        productName: String,
        productImage: String,

        priceAtAdd: Number,
        totalPrice: Number,

        status: {
          type: String,
          enum: ["placed", "pending", "cancelled"],
          default: "placed",
        },
        cancellationReason: {
          type: String,
          default: "none",
        },
      },
    ],
    discount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

const Cart = mongoose.model("Cart", cartSchema);
module.exports = Cart;
