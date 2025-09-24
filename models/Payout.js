// models/Payout.js
const mongoose = require("mongoose");
const { Schema } = mongoose;

const destinationSchema = new Schema({
  method: { type: String, enum: ["UPI", "BANK"], required: true },
  // UPI
  upiId: { type: String },
  // BANK
  accountName: { type: String },
  accountNumber: { type: String },
  ifsc: { type: String },
  bankName: { type: String },
  branch: { type: String },
}, { _id: false });

const transferSchema = new Schema({
  transactionRef: String,     // UTR/RRN/etc.
  paidAt: Date,
  notes: String,
  attachmentPath: String,     // optional receipt file
}, { _id: false });

const payoutSchema = new Schema({
  orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true, unique: true, index: true },
  userId:  { type: Schema.Types.ObjectId, ref: "User",  required: true, index: true },

  amount:  { type: Number, min: 0, required: true }, // rupees
  status:  { type: String, enum: ["pending_destination", "ready", "paid", "failed", "cancelled"], default: "pending_destination", index: true },

  destination: destinationSchema,
  transfer: transferSchema,
}, { timestamps: true });

module.exports = mongoose.model("Payout", payoutSchema);
