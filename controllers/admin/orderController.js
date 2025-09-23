// controllers/admin/orderController.js
const Order = require("../../models/Order");
const orderService = require("../../services/orderService");

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
    res.render("admin/orders/details", { order });
  } catch (err) {
    console.error(err);
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

exports.approveReturn = async (req, res) => {
  try {
    const { reason } = req.body;
    const order = await orderService.approveReturn(req.params.id, reason);
    res.redirect(`/admin/orders/${order._id}`);
  } catch (err) {
    res.status(400).send(err.message);
  }
};

exports.rejectReturn = async (req, res) => {
  try {
    const { rejectionReason, rejectionCategory } = req.body;
    const order = await orderService.rejectReturn(req.params.id, { rejectionReason, rejectionCategory });
    res.redirect(`/admin/orders/${order._id}`);
  } catch (err) {
    res.status(400).send(err.message);
  }
};

exports.refund = async (req, res) => {
  try {
    const { amount, reason } = req.body;
    const order = await orderService.refund(req.params.id, { amount, reason });
    res.redirect(`/admin/orders/${order._id}`);
  } catch (err) {
    res.status(400).send(err.message);
  }
};
