// services/orderService.js
const Order = require("../models/Order");

function r2(n) {
  return Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;
}

function recalcTotals(order) {
  const subtotal = r2((order.orderedItems || []).reduce((s, i) => s + Number(i.lineTotal || 0), 0));
  order.subtotal = subtotal;
  order.grandTotal = r2(subtotal - r2(order.discountAmount) + r2(order.shippingFee) + r2(order.taxAmount));
  order.totalPrice = order.subtotal;
  order.finalAmount = order.grandTotal;
  return order;
}

exports.updateStatus = async (id, status) => {
  const order = await Order.findById(id);
  if (!order) throw new Error("Order not found");

  if (order.orderStatus === "cancelled") throw new Error("Order already cancelled");

  order.orderStatus = status;
  if (status === "shipped") order.shippedAt = new Date();
  if (status === "delivered") order.deliveredAt = new Date();

  await order.save();
  return order;
};

exports.updateTracking = async (id, { shippingProvider, trackingNumber, trackingUrl }) => {
  const order = await Order.findById(id);
  if (!order) throw new Error("Order not found");

  order.shippingProvider = shippingProvider;
  order.trackingNumber = trackingNumber;
  order.trackingUrl = trackingUrl;

  await order.save();
  return order;
};

exports.cancelOrder = async (id, reason) => {
  const order = await Order.findById(id);
  if (!order) throw new Error("Order not found");

  if (!["pending", "processing"].includes(order.orderStatus)) {
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

  const item = order.orderedItems.id(itemId);
  if (!item) throw new Error("Item not found");
  if (item.productStatus !== "active") throw new Error("Item already cancelled/returned");

  item.productStatus = "cancelled";
  item.cancelReason = reason || "Cancelled by admin";
  item.lineTotal = 0;

  recalcTotals(order);
  await order.save();
  return order;
};

exports.approveReturn = async (id, reason) => {
  const order = await Order.findById(id);
  if (!order) throw new Error("Order not found");

  if (order.orderStatus !== "return_requested") {
    throw new Error("No return request to approve");
  }

  order.returnRequest.status = "approved";
  order.returnRequest.reviewedAt = new Date();
  order.orderStatus = "returning";
  if (reason) order.notes = reason;

  await order.save();
  return order;
};

exports.rejectReturn = async (id, { rejectionReason, rejectionCategory }) => {
  const order = await Order.findById(id);
  if (!order) throw new Error("Order not found");

  if (order.orderStatus !== "return_requested") {
    throw new Error("No return request to reject");
  }

  order.returnRequest.status = "rejected";
  order.returnRequest.reviewedAt = new Date();
  order.returnRequest.rejectionReason = rejectionReason;
  order.returnRequest.rejectionCategory = rejectionCategory;
  order.orderStatus = "delivered"; // roll back

  await order.save();
  return order;
};

exports.refund = async (id, { amount, reason }) => {
  const order = await Order.findById(id);
  if (!order) throw new Error("Order not found");

  if (!["paid", "authorized"].includes(order.payment.paymentStatus)) {
    throw new Error("Order not eligible for refund");
  }

  if (amount <= 0 || amount > order.grandTotal) {
    throw new Error("Invalid refund amount");
  }

  // 👉 TODO: Integrate payment gateway refund call here
  order.payment.paymentStatus = amount < order.grandTotal ? "partial_refund" : "refunded";
  order.notes = `Refunded ₹${amount}. Reason: ${reason || "N/A"}`;

  await order.save();
  return order;
};
