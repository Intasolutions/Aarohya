// services/payoutService.js
const mongoose = require("mongoose");
const Order = require("../models/Order");
const Payout = require("../models/Payout");

const r2 = (n) => Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;

function isCOD(order) {
  return (order.payment?.method || "").toLowerCase() === "cod";
}

function assertIFSC(ifsc) {
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(String(ifsc || "").toUpperCase())) {
    throw new Error("Invalid IFSC");
  }
}

exports.setDestination = async (orderId, dest) => {
  const order = await Order.findById(orderId);
  if (!order) throw new Error("Order not found");
  if (!isCOD(order)) throw new Error("Payout only for COD orders");
  if (!["return_requested", "returned"].includes(order.orderStatus)) {
    throw new Error("Payout available after a return is requested");
  }

  let payout = await Payout.findOne({ orderId: order._id });
  if (!payout) {
    payout = await Payout.create({
      orderId: order._id,
      userId: order.userId,
      amount: order.grandTotal, // initial; can be adjusted by finance if partial return
      status: "pending_destination",
    });
  }
  if (payout.status === "paid") throw new Error("Payout already paid");

  const method = String(dest.method || "").toUpperCase();
  if (!["UPI", "BANK"].includes(method)) throw new Error("Select a valid payout method");

  if (method === "UPI") {
    const upiId = String(dest.upiId || "").trim();
    if (!/^[\w.\-_]{2,}@[A-Za-z]{2,}$/.test(upiId)) throw new Error("Invalid UPI ID");
    payout.destination = { method: "UPI", upiId };
  } else {
    const accountName = String(dest.accountName || "").trim();
    const accountNumber = String(dest.accountNumber || "").trim();
    const ifsc = String(dest.ifsc || "").trim().toUpperCase();
    if (!accountName || !accountNumber) throw new Error("Account name/number required");
    assertIFSC(ifsc);
    payout.destination = {
      method: "BANK",
      accountName,
      accountNumber,
      ifsc,
      bankName: String(dest.bankName || "").trim(),
      branch: String(dest.branch || "").trim(),
    };
  }

  payout.status = "ready";
  await payout.save();
  return payout;
};

exports.markPaid = async (orderId, transfer) => {
  const order = await Order.findById(orderId);
  if (!order) throw new Error("Order not found");
  if (!isCOD(order)) throw new Error("Payout only for COD orders");

  const payout = await Payout.findOne({ orderId: order._id });
  if (!payout) throw new Error("No payout record");
  if (!payout.destination || !payout.status || payout.status === "pending_destination") {
    throw new Error("Payout destination missing");
  }
  if (payout.status === "paid") throw new Error("Already marked paid");

  payout.transfer = {
    transactionRef: String(transfer.transactionRef || "").trim(),
    paidAt: transfer.paidAt ? new Date(transfer.paidAt) : new Date(),
    notes: transfer.notes || "",
    attachmentPath: transfer.attachmentPath || undefined,
  };
  payout.status = "paid";
  await payout.save();

  // Reflect in order: mark “refunded” and keep audit trail in refunds array
  await Order.updateOne(
    { _id: order._id },
    {
      $set: { "payment.paymentStatus": "refunded" },
      $push: {
        "payment.refunds": {
          refundId: `COD-PAYOUT-${payout._id}`,
          amount: Math.round(Number(payout.amount || order.grandTotal) * 100), // paise for consistency
          status: "processed",
          createdAt: new Date(),
          notes: { type: "COD_PAYOUT", transactionRef: payout.transfer.transactionRef }
        }
      }
    }
  );

  return payout;
};
