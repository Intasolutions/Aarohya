const mongoose = require("mongoose");
const { Schema } = mongoose;

const userSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      required: false,
      unique: false,
      sparse: true,
    },
    googleId: {
      type: String,
      sparse: true,
      unique: true,
    },
    password: {
      type: String,
      required: false, // optional for social login
    },

    // Status flags
    isBlocked: {
      type: Boolean,
      default: false,
    },
    isAdmin: {
      type: Boolean,
      default: false,
    },
    // Add this inside userSchema
    isDeleted: {
      type: Boolean,
      default: false,
    },

    // Profile
    profileImage: {
      type: String,
      default: null,
    },

    // Referral system
    referralCode: {
      type: String,
      unique: true,
      sparse: true,
    },
    referredBy: {
      type: String,
      default: null,
    },
    redeemedUsers: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // Relations
    addresses: [
      {
        type: Schema.Types.ObjectId,
        ref: "Address", // fixed typo "Adress"
      },
    ],
    orders: [
      {
        type: Schema.Types.ObjectId,
        ref: "Order",
      },
    ],
    payments: [
      {
        type: Schema.Types.ObjectId,
        ref: "Payment",
      },
    ],
    wishlist: [
      {
        type: Schema.Types.ObjectId,
        ref: "Product",
      },
    ],
    cart: [
      {
        type: Schema.Types.ObjectId,
        ref: "Cart",
      },
    ],
    wallet: [
      {
        type: Schema.Types.ObjectId,
        ref: "Wallet",
      },
    ],
    orderHistory: [
      {
        type: Schema.Types.ObjectId,
        ref: "Order",
      },
    ],
    coupons: [
      {
        type: Schema.Types.ObjectId,
        ref: "Coupon",
      },
    ],
    reviews: [
      {
        type: Schema.Types.ObjectId,
        ref: "Review",
      },
    ],

    // Search history tracking
    searchHistory: [
      {
        category: {
          type: Schema.Types.ObjectId,
          ref: "Category",
        },
        brand: {
          type: Schema.Types.ObjectId,
          ref: "Brand",
        },
        searchOn: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);
module.exports = User;
