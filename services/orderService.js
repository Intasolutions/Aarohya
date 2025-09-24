// services/orderService.js
const mongoose = require("mongoose");
const Order = require("../models/Order");
const payoutService = require("./payoutService");


const RZP_KEY_ID = process.env.RAZORPAY_KEY_ID || "";
const RZP_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "";

let Razorpay = null;
if (RZP_KEY_ID && RZP_KEY_SECRET) {
  try { Razorpay = require("razorpay"); }
  catch { console.warn("Razorpay SDK not installed; run `npm i razorpay`."); }
}

// ---------- utils ----------
const r2 = (n) => Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;
const toPaise = (n) => Math.max(0, Math.round(Number(n || 0) * 100));

function ensureRazorpay() {
  if (!RZP_KEY_ID || !RZP_KEY_SECRET || !Razorpay) {
    const err = new Error("Online refund not available. Configure Razorpay.");
    err.status = 400;
    throw err;
  }
  return new Razorpay({ key_id: RZP_KEY_ID, key_secret: RZP_KEY_SECRET });
}

/** When lineItem schema has _id:false, subdoc .id() may not work */
function getItemByIdOrIndex(order, itemId) {
  const byId = order.orderedItems.id?.(itemId);
  if (byId) return { item: byId, index: order.orderedItems.indexOf(byId) };
  const idx = Number.isInteger(+itemId) ? +itemId : -1;
  if (idx >= 0 && idx < order.orderedItems.length) {
    return { item: order.orderedItems[idx], index: idx };
  }
  return null;
}

// ---------- totals recalc (only for admin hard-cancel before ship) ----------
function recalcTotals(order) {
  const subtotal = r2((order.orderedItems || []).reduce((s, i) => s + Number(i.lineTotal || 0), 0));
  order.subtotal = subtotal;
  order.grandTotal = r2(subtotal - r2(order.discountAmount) + r2(order.shippingFee) + r2(order.taxAmount));
  order.totalPrice = order.subtotal;
  order.finalAmount = order.grandTotal;
  return order;
}

/** Prorate discount share */
function prorate(base, subtotal, discountAmount) {
  if (!discountAmount || discountAmount <= 0 || !subtotal) return 0;
  return (Number(base) / Number(subtotal)) * Number(discountAmount);
}

/** Compute refundable amount from return snapshot items */
function computeRefundableAmount(order) {
  const rr = order.returnRequest || {};
  const retItems = Array.isArray(rr.items) ? rr.items : [];
  if (!retItems.length) return 0;

  const returnedValue = retItems.reduce((s, it) => s + Number(it.unitPrice || 0) * Number(it.quantity || 0), 0);
  const discountShare = prorate(returnedValue, order.subtotal || 0, order.discountAmount || 0);
  const taxShare = prorate(returnedValue, order.subtotal || 0, order.taxAmount || 0);

  const totalQty = (order.orderedItems || []).reduce((s, it) => s + Number(it.quantity || 0), 0);
  const returnedQty = retItems.reduce((s, it) => s + Number(it.quantity || 0), 0);
  const isFullReturn = totalQty > 0 && returnedQty === totalQty;
  const shippingRefund = isFullReturn ? Number(order.shippingFee || 0) : 0;

  const refundable = r2(returnedValue - discountShare + shippingRefund + taxShare);
  return Math.min(refundable, Number(order.grandTotal || 0));
}

// ---------------------- PUBLIC API ----------------------

exports.updateStatus = async (id, status) => {
  const allowed = ["pending","processing","shipped","delivered","cancelled","return_requested","returning","returned"];
  if (!allowed.includes(status)) throw new Error("Invalid status");

  const order = await Order.findById(id);
  if (!order) throw new Error("Order not found");

  const cur = order.orderStatus;
  if (cur === "cancelled" && status !== "cancelled") throw new Error("Cancelled order cannot change status");
  if (cur === "returned" && status !== "returned") throw new Error("Returned order cannot change status");

  order.orderStatus = status;
  if (status === "shipped") order.shippedAt = new Date();
  if (status === "delivered") order.deliveredAt = new Date();
  await order.save();
  return order;
};

exports.updateTracking = async (id, { shippingProvider, trackingNumber, trackingUrl }) => {
  const order = await Order.findById(id);
  if (!order) throw new Error("Order not found");

  order.shippingProvider = (shippingProvider || "").trim();
  order.trackingNumber = (trackingNumber || "").trim();
  order.trackingUrl = (trackingUrl || "").trim();
  await order.save();
  return order;
};

exports.cancelOrder = async (id, reason) => {
  const order = await Order.findById(id);
  if (!order) throw new Error("Order not found");

  if (!["pending","processing"].includes(order.orderStatus)) {
    throw new Error("Order cannot be cancelled in this state");
  }
  order.orderStatus = "cancelled";
  order.cancelReason = reason || "Cancelled by admin";
  await order.save();
  return order;
};

exports.cancelItem = async (id, itemId, reason) => {
  const order = await Order.findById(id);
  if (!order) throw new Error("Order not found");

  const found = getItemByIdOrIndex(order, itemId);
  if (!found) throw new Error("Item not found");
  const { item } = found;

  if (item.productStatus !== "active") throw new Error("Item already cancelled/returned");
  item.productStatus = "cancelled";
  item.cancelReason = reason || "Cancelled by admin";

  if (["pending","processing"].includes(order.orderStatus)) {
    item.lineTotal = 0;
  }
  recalcTotals(order);
  await order.save();
  return order;
};

/* -------- Returns: approve / reject / receive / refund -------- */

exports.approveReturn = async (id, note) => {
  const order = await Order.findById(id);
  if (!order) throw new Error("Order not found");
  if (order.orderStatus !== "return_requested") throw new Error("No return request to approve");

  order.returnRequest.status = "approved";
  order.returnRequest.reviewedAt = new Date();
  order.orderStatus = "returning";
  if (note) order.notes = String(note).slice(0, 1000);
  await order.save();
  return order;
};

exports.rejectReturn = async (id, { rejectionReason, rejectionCategory }) => {
  const order = await Order.findById(id);
  if (!order) throw new Error("Order not found");
  if (order.orderStatus !== "return_requested") throw new Error("No return request to reject");

  order.returnRequest.status = "rejected";
  order.returnRequest.reviewedAt = new Date();
  order.returnRequest.rejectionReason = rejectionReason || "Not eligible";
  order.returnRequest.rejectionCategory = rejectionCategory || "policy";
  order.orderStatus = "delivered";
  await order.save();
  return order;
};

/** After pickup & QC pass */
exports.markReturnReceived = async (id) => {
  const order = await Order.findById(id);
  if (!order) throw new Error("Order not found");
  if (!["returning","return_requested"].includes(order.orderStatus)) {
    throw new Error("Return not in progress");
  }

  const rr = order.returnRequest || {};
  const retItems = Array.isArray(rr.items) ? rr.items : [];

  if (retItems.length) {
    for (const rit of retItems) {
      const idx = order.orderedItems.findIndex(
        oi => String(oi.productId) === String(rit.productId) && Number(oi.unitPrice) === Number(rit.unitPrice)
      );
      if (idx >= 0) {
        order.orderedItems[idx].productStatus = "returned";
        order.orderedItems[idx].returnReason = order.returnRequest?.reason || "";
      }
    }
  }

  order.orderStatus = "returned";
  await order.save();
  // If COD, auto-create a payout record (pending destination)
try {
  if (String(order.payment?.method || "").toLowerCase() === "cod") {
    await payoutService.createForOrder(order._id);
  }
} catch (e) {
  // non-blocking; log if you have a logger
  console.warn("createForOrder (COD) failed:", e.message);
}

  return order;
};

// Alias for controller convenience
exports.receiveReturn = async (id) => exports.markReturnReceived(id);

/** Return refund (auto-calc or amountOverride) */
exports.refundReturn = async (id, { amountOverride, reason }) => {
  const order = await Order.findById(id);
  if (!order) throw new Error("Order not found");

  if (order.returnRequest?.status !== "approved" && order.orderStatus !== "returned") {
    throw new Error("Return not approved/received");
  }

  const computed = computeRefundableAmount(order);
  let finalAmount = Number(amountOverride || computed);
  if (!(finalAmount > 0)) throw new Error("Refund amount must be > 0");
  if (finalAmount > computed) finalAmount = computed;

  const method = (order.payment?.method || "").toLowerCase();
  const paid   = (order.payment?.paymentStatus || "").toLowerCase();
  if (!["razorpay","online","online payment"].includes(method) || !["paid","authorized"].includes(paid)) {
    throw new Error("Only online-paid orders can be refunded.");
  }
  if (!order.payment.razorpayPaymentId) throw new Error("Missing razorpayPaymentId on order.");

  const instance = ensureRazorpay();

  // Ensure payment captured (if authorized, capture then refund)
  const capturedPaise = toPaise(order.grandTotal);
  const payment = await instance.payments.fetch(order.payment.razorpayPaymentId);
  if (!payment) throw new Error("Razorpay: payment not found.");
  if (payment.status === "authorized") {
    await instance.payments.capture(order.payment.razorpayPaymentId, capturedPaise, "INR");
    const p2 = await instance.payments.fetch(order.payment.razorpayPaymentId);
    if (p2.status !== "captured") throw new Error(`Payment not captured yet (status: ${p2.status}).`);
  } else if (payment.status !== "captured") {
    throw new Error(`Refund not allowed: payment status is ${payment.status}.`);
  }

  const paise = toPaise(finalAmount);
  const alreadyRefunded = (order.payment.refunds || []).reduce((s, r) => s + Number(r.amount || 0), 0);
  if (alreadyRefunded + paise > capturedPaise) throw new Error("Refund exceeds captured amount.");

  const refund = await instance.payments.refund(order.payment.razorpayPaymentId, {
    amount: paise,
    speed: "normal",
    notes: { orderId: order.orderId, reason: reason || order.returnRequest?.reason || "Return refund" },
  });

  order.payment.refunds = order.payment.refunds || [];
  order.payment.refunds.push({
    refundId: refund.id,
    amount: Number(refund.amount || paise),
    status: refund.status || "processed",
    createdAt: new Date(),
    notes: refund.notes || {},
  });

  const totalRefunded = (order.payment.refunds || []).reduce((s, r) => s + Number(r.amount || 0), 0);
  if (totalRefunded >= capturedPaise) order.payment.paymentStatus = "refunded";
  else order.payment.paymentStatus = "partial_refund";

  await order.save();
  return order;
};

/* -------- Manual refund (not tied to a return) -------- */
exports.refund = async (id, { amount, reason }) => {
  const order = await Order.findById(id);
  if (!order) throw new Error("Order not found");

  const method = (order.payment?.method || "").toLowerCase();
  const paid   = (order.payment?.paymentStatus || "").toLowerCase();
  if (!["razorpay","online","online payment"].includes(method) || !["paid","authorized"].includes(paid)) {
    throw new Error("Only online-paid orders can be refunded.");
  }
  if (!(amount > 0)) throw new Error("Invalid refund amount");
  if (!order.payment.razorpayPaymentId) throw new Error("Missing razorpayPaymentId on order");

  const instance = ensureRazorpay();

  // Ensure captured
  const capturedPaise = toPaise(order.grandTotal);
  const payment = await instance.payments.fetch(order.payment.razorpayPaymentId);
  if (!payment) throw new Error("Razorpay: payment not found.");
  if (payment.status === "authorized") {
    await instance.payments.capture(order.payment.razorpayPaymentId, capturedPaise, "INR");
    const p2 = await instance.payments.fetch(order.payment.razorpayPaymentId);
    if (p2.status !== "captured") throw new Error(`Payment not captured yet (status: ${p2.status}).`);
  } else if (payment.status !== "captured") {
    throw new Error(`Refund not allowed: payment status is ${payment.status}.`);
  }

  const paise = toPaise(amount);
  const alreadyRefunded = (order.payment.refunds || []).reduce((s, r) => s + Number(r.amount || 0), 0);
  if (alreadyRefunded + paise > capturedPaise) throw new Error("Refund exceeds captured amount.");

  const refund = await instance.payments.refund(order.payment.razorpayPaymentId, {
    amount: paise,
    speed: "normal",
    notes: { orderId: order.orderId, reason: reason || "Manual refund" },
  });

  order.payment.refunds = order.payment.refunds || [];
  order.payment.refunds.push({
    refundId: refund.id,
    amount: Number(refund.amount || paise),
    status: refund.status || "processed",
    createdAt: new Date(),
    notes: refund.notes || {},
  });

  const totalRefunded = (order.payment.refunds || []).reduce((s, r) => s + Number(r.amount || 0), 0);
  if (totalRefunded >= capturedPaise) order.payment.paymentStatus = "refunded";
  else order.payment.paymentStatus = "partial_refund";

  await order.save();
  return order;
};
