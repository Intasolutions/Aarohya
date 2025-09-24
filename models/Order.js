// models/Order.js
const mongoose = require("mongoose");
const { Schema } = mongoose;

const ORDER_STATUS = [
  "pending",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "return_requested",
  "returning",
  "returned",
];

const PAYMENT_METHODS = ["cod", "wallet", "razorpay", "online", "online payment"];

const PAYMENT_STATUS = [
  "pending",
  "authorized",
  "paid",
  "failed",
  "refunded",
  "partial_refund",
];

const COLOR_ENUM = ["Silver", "Gold", "Rose Gold", "none"];

/* -------------------- Line Items -------------------- */
const lineItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    productName: { type: String, required: true },
    productNumber: String,
    image: String,
    color: { type: String, enum: COLOR_ENUM, default: "none" },
    unitPrice: { type: Number, min: 0, required: true },
    quantity: { type: Number, min: 1, required: true },
    lineTotal: { type: Number, min: 0, required: true },
    productStatus: {
      type: String,
      enum: ["active", "cancelled", "returned"],
      default: "active",
      index: true,
    },
    cancelReason: String,
    returnReason: String,
  },
  { _id: false }
);

/* -------------------- Address Snapshot -------------------- */
const addressSnapshotSchema = new Schema(
  {
    addressType: { type: String, required: true },
    name: { type: String, required: true },
    apartment: { type: String, required: true },
    building: { type: String, required: true },
    street: { type: String, required: true },
    landmark: { type: String },
    city: { type: String, required: true },
    state: { type: String, required: true },
    country: { type: String, required: true },
    zip: { type: String, required: true },
    phone: { type: String, required: true },
    altPhone: { type: String },
  },
  { _id: false }
);

/* -------------------- Return Request -------------------- */
const returnRequestSchema = new Schema(
  {
    status: {
      type: String,
      enum: ["none", "pending", "approved", "rejected"],
      default: "none",
    },
    reason: String,
    description: String,
    images: [String],
    requestedAt: Date,
    reviewedAt: Date,
    rejectionReason: String,
    rejectionCategory: String,
    items: [
      {
        productId: { type: Schema.Types.ObjectId, required: true },
        productName: { type: String, required: true },
        quantity: { type: Number, min: 1, required: true },
        unitPrice: { type: Number, min: 0, required: true },
        lineTotal: { type: Number, min: 0, required: true },
      },
    ],
  },
  { _id: false }
);

/* -------------------- Payment -------------------- */
const refundSchema = new Schema(
  {
    refundId: { type: String, index: true },
    amount: { type: Number, min: 0 }, // in paise
    status: { type: String },          // processed/pending/failed
    createdAt: { type: Date, default: Date.now },
    notes: { type: Schema.Types.Mixed },
  },
  { _id: false }
);

const paymentSchema = new Schema(
  {
    method: { type: String, enum: PAYMENT_METHODS, required: true },
    paymentStatus: {
      type: String,
      enum: PAYMENT_STATUS,
      default: "pending",
      index: true,
    },
    isPaid: { type: Boolean, default: false },
    transactionId: String,

    // Razorpay fields
    razorpayOrderId: { type: String, index: true },         // NOT UNIQUE (retries create new orderIds)
    razorpayPaymentId: { type: String, index: true, sparse: true, unique: true },
    razorpaySignature: String,

    refunds: [refundSchema],
  },
  { _id: false }
);

/* -------------------- Main Order Schema -------------------- */
const orderSchema = new Schema(
  {
    orderId: { type: String, unique: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },

    orderedItems: {
      type: [lineItemSchema],
      validate: {
        validator: (a) => Array.isArray(a) && a.length > 0,
        message: "orderedItems required",
      },
      required: true,
    },

    subtotal: { type: Number, min: 0, required: true },
    discountAmount: { type: Number, min: 0, default: 0 },
    shippingFee: { type: Number, min: 0, default: 0 },
    taxAmount: { type: Number, min: 0, default: 0 },
    grandTotal: { type: Number, min: 0, required: true },

    // legacy mirrors (optional but kept for compatibility)
    totalPrice: Number,
    finalAmount: Number,

    couponApplied: { type: Boolean, default: false },
    couponId: { type: Schema.Types.ObjectId, ref: "Coupon" },
    couponCode: String,

    shippingAddress: { type: addressSnapshotSchema, required: true },

    orderStatus: {
      type: String,
      enum: ORDER_STATUS,
      default: "pending",
      index: true,
    },
    cancelReason: String,

    placedAt: Date,
    paidAt: Date,
    shippedAt: Date,
    deliveredAt: Date,
    invoiceDate: Date,

    payment: { type: paymentSchema, required: true },

    // return request
    returnRequest: { type: returnRequestSchema, default: () => ({}) },

    // legacy top-level mirrors (for compatibility/old code)
    paymentMethod: String,
    paymentStatus: String,
    razorpayOrderId: String, // keep for compat; DO NOT make unique
  },
  { timestamps: true }
);

// Basic indexes
orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ orderStatus: 1, createdAt: -1 });
orderSchema.index({ "orderedItems.productId": 1 });

module.exports = mongoose.model("Order", orderSchema);
