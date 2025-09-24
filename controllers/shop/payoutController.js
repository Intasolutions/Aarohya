// controllers/shop/payoutController.js
const mongoose = require("mongoose");
const Order = require("../../models/Order");
const Payout = require("../../models/Payout");

// ---- helpers ----
const r2 = (n) => Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;

function prorate(base, subtotal, discountAmount) {
  if (!discountAmount || discountAmount <= 0 || !subtotal) return 0;
  return (Number(base) / Number(subtotal)) * Number(discountAmount);
}

function computeRefundableAmount(order) {
  const rr = order.returnRequest || {};
  const retItems = Array.isArray(rr.items) && rr.items.length
    ? rr.items
    : (order.orderedItems || []).map(it => ({
        productId: it.productId,
        productName: it.productName,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        lineTotal: r2(Number(it.unitPrice) * Number(it.quantity)),
      }));

  const itemsVal = retItems.reduce((s, it) => s + Number(it.unitPrice || 0) * Number(it.quantity || 0), 0);
  const discountShare = prorate(itemsVal, order.subtotal || 0, order.discountAmount || 0);
  const taxShare = prorate(itemsVal, order.subtotal || 0, order.taxAmount || 0);

  const totQty = (order.orderedItems || []).reduce((s, it) => s + Number(it.quantity || 0), 0);
  const retQty = retItems.reduce((s, it) => s + Number(it.quantity || 0), 0);
  const isFull = totQty > 0 && retQty === totQty;
  const shippingRefund = isFull ? Number(order.shippingFee || 0) : 0;

  const refundable = r2(itemsVal - discountShare + shippingRefund + taxShare);
  return Math.min(refundable, Number(order.grandTotal || refundable || 0));
}

function validateDestination(dest = {}) {
  const method = String(dest.method || "").toUpperCase();
  if (!["UPI","BANK"].includes(method)) throw new Error("Select a valid payout method");

  if (method === "UPI") {
    const upi = String(dest.upiId || "").trim();
    if (!/^[\w.\-_]{2,}@[A-Za-z]{2,}$/.test(upi)) throw new Error("Invalid UPI ID");
    return { method: "UPI", upiId: upi };
  }
  const accountName = String(dest.accountName || "").trim();
  const accountNumber = String(dest.accountNumber || "").trim();
  const ifsc = String(dest.ifsc || "").trim().toUpperCase();
  if (!accountName || !accountNumber) throw new Error("Account name/number required");
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) throw new Error("Invalid IFSC");
  return {
    method: "BANK",
    accountName, accountNumber, ifsc,
    bankName: String(dest.bankName || "").trim(),
    branch: String(dest.branch || "").trim(),
  };
}

/**
 * Ensure a payout row exists for a COD order once a return is requested or completed.
 * Allowed orderStatus: "return_requested" OR "returned"
 */
async function ensurePayoutForOrder(order) {
  const method = (order.payment?.method || "").toLowerCase();
  if (method !== "cod") throw new Error("Payout only for COD orders");

  if (!["return_requested", "returned"].includes(order.orderStatus)) {
    throw new Error("Payout available after a return is requested");
  }

  let payout = await Payout.findOne({ orderId: order._id });
  if (payout) return payout;

  const amount = computeRefundableAmount(order);
  if (!(amount > 0)) throw new Error("Nothing refundable for this order");

  payout = await Payout.create({
    orderId: order._id,
    userId: order.userId,
    amount,
    status: "pending_destination",
  });
  return payout;
}

// ---- controllers ----
exports.getForm = async (req, res) => {
  const id = req.params.id;
  if (!req.user) return res.redirect("/auth/login");
  if (!mongoose.isValidObjectId(id)) return res.redirect("/orders");

  const order = await Order.findOne({ _id: id, userId: req.user._id }).lean();
  if (!order) return res.redirect("/orders");

  try {
    const payout = await ensurePayoutForOrder(order);

    // If already provided or paid, no point showing the form
    if (payout.status === "ready") {
      return res.redirect(`/orders/${id}?ok=${encodeURIComponent("Refund details already submitted. We’ll process it shortly.")}`);
    }
    if (payout.status === "paid") {
      return res.redirect(`/orders/${id}?ok=${encodeURIComponent("Refund has already been paid.")}`);
    }

    return res.render("shop/payout-destination", { order, error: "", ok: "" });
  } catch (e) {
    return res.redirect(`/orders/${id}?err=${encodeURIComponent(e.message || "Payout not available")}`);
  }
};

exports.saveDestination = async (req, res) => {
  const id = req.params.id;
  if (!req.user) return res.redirect("/auth/login");
  if (!mongoose.isValidObjectId(id)) return res.redirect("/orders");

  const order = await Order.findOne({ _id: id, userId: req.user._id });
  if (!order) return res.redirect("/orders");

  try {
    const payout = await ensurePayoutForOrder(order);

    if (payout.status === "paid") {
      return res.redirect(`/orders/${id}?ok=${encodeURIComponent("Refund already paid.")}`);
    }
    if (payout.status !== "pending_destination") {
      // Only allow setting while pending_destination (prevents overwrite after finance lock)
      return res.redirect(`/orders/${id}?ok=${encodeURIComponent("Refund details already on file.")}`);
    }

    payout.destination = validateDestination({
      method: req.body.method,
      upiId: req.body.upiId,
      accountName: req.body.accountName,
      accountNumber: req.body.accountNumber,
      ifsc: req.body.ifsc,
      bankName: req.body.bankName,
      branch: req.body.branch,
    });
    payout.status = "ready";
    await payout.save();

    return res.redirect(`/orders/${id}?ok=${encodeURIComponent("Refund destination saved. We’ll process it soon.")}`);
  } catch (err) {
    return res.status(400).render("shop/payout-destination", {
      order: order.toObject ? order.toObject() : order,
      error: err.message || "Could not save",
      ok: ""
    });
  }
};
