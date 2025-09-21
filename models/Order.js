// models/Order.js
const mongoose = require("mongoose");
const { Schema } = mongoose;

const ORDER_STATUS = ["pending","processing","shipped","delivered","cancelled","return_requested","returning","returned"];
const PAYMENT_METHODS = ["cod","wallet","razorpay","online","online payment"];
const PAYMENT_STATUS = ["pending","authorized","paid","failed","refunded","partial_refund"];
const COLOR_ENUM = ["Silver","Gold","Rose Gold","none"];

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
    productStatus: { type: String, enum: ["active","cancelled","returned"], default: "active", index: true },
    cancelReason: String,
    returnReason: String,
  },
  { _id: false }
);

const addressSnapshotSchema = new Schema(
  {
    addressType: { type: String, required: true },
    name: { type: String, required: true },
    apartment: { type: String, required: true },
    building: { type: String, required: true },
    street: { type: String, required: true },
    landmark: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    country: { type: String, required: true },
    zip: { type: String, required: true },
    phone: { type: String, required: true },
    altPhone: { type: String, required: true },
  },
  { _id: false }
);

const returnRequestSchema = new Schema(
  {
    status: { type: String, enum: ["none","pending","approved","rejected"], default: "none" },
    reason: String,
    description: String,
    images: [String],
    requestedAt: Date,
    reviewedAt: Date,
    rejectionReason: String,
    rejectionCategory: String,
  },
  { _id: false }
);

const paymentSchema = new Schema(
  {
    method: { type: String, enum: PAYMENT_METHODS, required: true },
    paymentStatus: { type: String, enum: PAYMENT_STATUS, default: "pending", index: true },
    isPaid: { type: Boolean, default: false },
    transactionId: String,
    razorpayOrderId: { type: String, index: true, sparse: true, unique: true },
    razorpayPaymentId: String,
    razorpaySignature: String,
  },
  { _id: false }
);

const orderSchema = new Schema(
  {
    orderId: { type: String, unique: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    orderedItems: {
      type: [lineItemSchema],
      validate: { validator: a => Array.isArray(a) && a.length > 0, message: "orderedItems required" },
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

    orderStatus: { type: String, enum: ORDER_STATUS, default: "pending", index: true },
    cancelReason: String,

    placedAt: Date,
    paidAt: Date,
    shippedAt: Date,
    deliveredAt: Date,
    invoiceDate: Date,

    payment: { type: paymentSchema, required: true },

    // legacy top-level mirrors
    paymentMethod: { type: String, enum: PAYMENT_METHODS },
    paymentStatus: { type: String, enum: PAYMENT_STATUS },
    razorpayOrderId: { type: String, sparse: true, unique: true },

    returnRequest: { type: returnRequestSchema, default: () => ({}) },

    shippingProvider: String,
    trackingNumber: { type: String, index: true },
    trackingUrl: String,
    notes: String,
  },
  { timestamps: true }
);

// virtual for older code using `status`
orderSchema.virtual("status").get(function(){ return this.orderStatus; }).set(function(v){ this.orderStatus = v; });
orderSchema.virtual("isCancelable").get(function(){ return ["pending","processing"].includes(this.orderStatus); });

const genId = () => {
  const d = new Date(), y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,"0");
  return `ORD-${y}-${m}-${Math.random().toString(36).slice(2,8).toUpperCase()}`;
};
const r2 = n => Math.round((Number(n||0)+Number.EPSILON)*100)/100;

orderSchema.pre("validate", function(next){
  if (!this.orderId) this.orderId = genId();
  if (!this.placedAt) this.placedAt = new Date();

  const subtotal = r2((this.orderedItems||[]).reduce((s,i)=>s+Number(i.lineTotal||0),0));
  this.subtotal = subtotal;
  const grand = r2(subtotal - r2(this.discountAmount) + r2(this.shippingFee) + r2(this.taxAmount));
  this.grandTotal = grand;

  if (this.totalPrice == null) this.totalPrice = this.subtotal;
  if (this.finalAmount == null) this.finalAmount = this.grandTotal;

  if (this.payment) {
    if (this.payment.method === "online payment") this.payment.method = "online payment";
    this.payment.isPaid = ["authorized","paid"].includes(this.payment.paymentStatus);
    if (!this.paymentMethod) this.paymentMethod = this.payment.method;
    if (!this.paymentStatus) this.paymentStatus = this.payment.paymentStatus;
    if (this.payment.razorpayOrderId && !this.razorpayOrderId) this.razorpayOrderId = this.payment.razorpayOrderId;
    if (this.payment.isPaid && !this.paidAt) this.paidAt = new Date();
  }
  next();
});

orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ orderStatus: 1, createdAt: -1 });
orderSchema.index({ "orderedItems.productId": 1 });

const Order = mongoose.model("Order", orderSchema);
Order.STATUS = ORDER_STATUS;
Order.PAYMENT_METHODS = PAYMENT_METHODS;
Order.PAYMENT_STATUS = PAYMENT_STATUS;
Order.COLOR_ENUM = COLOR_ENUM;

module.exports = Order;
