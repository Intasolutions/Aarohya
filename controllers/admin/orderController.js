// controllers/admin/orderController.js
const Order = require("../../models/Order");
const Payout = require("../../models/Payout");              // <-- add this
const orderService = require("../../services/orderService");
const logger = require("../../utils/logger");
const payoutService = require("../../services/payoutService");

exports.listOrders = async (req, res) => {
  try {
    const { status, paymentStatus, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.orderStatus = status;
    if (paymentStatus) filter["payment.paymentStatus"] = paymentStatus;

    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean();

    const total = await Order.countDocuments(filter);
    res.render("admin/orders/list", { orders, total, page, limit });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching orders");
  }
};

exports.getOrderDetails = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).lean();
    if (!order) return res.status(404).send("Order not found");

    // Fetch payout (so EJS has `payout` defined)
    let payout = null;
    try {
      payout = await Payout.findOne({ orderId: order._id }).lean();
    } catch (_) {
      payout = null;
    }

    res.render("admin/orders/details", {
      order,
      payout,                                         // <-- pass it
      error: req.query.err || "",
      ok: req.query.ok || ""
    });
  } catch (err) {
    logger.logErr("getOrderDetails ERR", err);
    res.status(500).send("Error fetching order");
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const order = await orderService.updateStatus(req.params.id, status);
    res.redirect(`/admin/orders/${order._id}`);
  } catch (err) {
    console.error(err);
    res.status(400).send(err.message);
  }
};

exports.updateTracking = async (req, res) => {
  try {
    const { shippingProvider, trackingNumber, trackingUrl } = req.body;
    const order = await orderService.updateTracking(req.params.id, { shippingProvider, trackingNumber, trackingUrl });
    res.redirect(`/admin/orders/${order._id}`);
  } catch (err) {
    console.error(err);
    res.status(400).send(err.message);
  }
};

exports.cancelOrder = async (req, res) => {
  try {
    const { reason } = req.body;
    const order = await orderService.cancelOrder(req.params.id, reason);
    res.redirect(`/admin/orders/${order._id}`);
  } catch (err) {
    res.status(400).send(err.message);
  }
};

exports.cancelItem = async (req, res) => {
  try {
    const { reason } = req.body;
    const order = await orderService.cancelItem(req.params.id, req.params.itemId, reason);
    res.redirect(`/admin/orders/${order._id}`);
  } catch (err) {
    res.status(400).send(err.message);
  }
};

/* -------- Returns: approve / reject / receive / refund -------- */

exports.approveReturn = async (req, res) => {
  const id = req.params.id;
  try {
    const { reason } = req.body;
    const order = await orderService.approveReturn(id, reason);
    return res.redirect(`/admin/orders/${order._id}?ok=${encodeURIComponent("Return approved")}`);
  } catch (err) {
    logger.logErr("approveReturn ERR", err);
    return res.redirect(`/admin/orders/${id}?err=${encodeURIComponent(err.message || "Could not approve return")}`);
  }
};

exports.rejectReturn = async (req, res) => {
  const id = req.params.id;
  try {
    const { rejectionReason, rejectionCategory } = req.body;
    const order = await orderService.rejectReturn(id, { rejectionReason, rejectionCategory });
    return res.redirect(`/admin/orders/${order._id}?ok=${encodeURIComponent("Return rejected")}`);
  } catch (err) {
    logger.logErr("rejectReturn ERR", err);
    return res.redirect(`/admin/orders/${id}?err=${encodeURIComponent(err.message || "Could not reject return")}`);
  }
};

exports.receiveReturn = async (req, res) => {
  const id = req.params.id;
  try {
    const order = await orderService.receiveReturn(id);
    return res.redirect(`/admin/orders/${order._id}?ok=${encodeURIComponent("Marked as returned (received & QC passed).")}`);
  } catch (err) {
    logger.logErr("receiveReturn ERR", err);
    return res.redirect(`/admin/orders/${id}?err=${encodeURIComponent(err.message || "Could not mark as received")}`);
  }
};

exports.refundReturn = async (req, res) => {
  const id = req.params.id;
  try {
    const amount = req.body.amount ? Number(req.body.amount) : undefined;
    const reason = req.body.reason;
    const order = await orderService.refundReturn(id, { amountOverride: amount, reason });
    const okMsg = amount ? `Return refund issued ₹${amount}` : `Return refund issued`;
    return res.redirect(`/admin/orders/${order._id}?ok=${encodeURIComponent(okMsg)}`);
  } catch (err) {
    logger.logErr("refundReturn ERR", err);
    return res.redirect(`/admin/orders/${id}?err=${encodeURIComponent(err.message || "Return refund failed")}`);
  }
};

/* -------- Manual refund -------- */

exports.refund = async (req, res) => {
  const id = req.params.id;
  try {
    const { amount, reason } = req.body;
    const order = await orderService.refund(id, { amount: Number(amount), reason });
    return res.redirect(`/admin/orders/${order._id}?ok=${encodeURIComponent(`Refunded ₹${amount}`)}`);
  } catch (err) {
    logger.logErr("refund ERR", err);
    return res.redirect(`/admin/orders/${id}?err=${encodeURIComponent(err.message || "Refund failed")}`);
  }
};

/* -------- COD Payout (Admin) -------- */

// Save destination (UPI/BANK)
exports.savePayoutDestination = async (req, res) => {
  const id = req.params.id;
  try {
    await payoutService.setDestination(id, {
      method: req.body.method,       // "UPI" | "BANK"
      upiId: req.body.upiId,
      accountName: req.body.accountName,
      accountNumber: req.body.accountNumber,
      ifsc: req.body.ifsc,
      bankName: req.body.bankName,
      branch: req.body.branch,
    });
    res.redirect(`/admin/orders/${id}?ok=${encodeURIComponent("Payout destination saved")}`);
  } catch (err) {
    res.redirect(`/admin/orders/${id}?err=${encodeURIComponent(err.message || "Could not save destination")}`);
  }
};

// Mark payout paid
exports.markPayoutPaid = async (req, res) => {
  const id = req.params.id;
  try {
    await payoutService.markPaid(id, {
      transactionRef: req.body.transactionRef,
      paidAt: req.body.paidAt,
      notes: req.body.notes,
      // attachmentPath: set this if you wire a file upload for receipts
    });
    res.redirect(`/admin/orders/${id}?ok=${encodeURIComponent("COD refund marked as paid")}`);
  } catch (err) {
    res.redirect(`/admin/orders/${id}?err=${encodeURIComponent(err.message || "Could not mark payout as paid")}`);
  }
};
