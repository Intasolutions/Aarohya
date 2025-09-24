// controllers/shop/paymentController.js
const mongoose = require("mongoose");
const crypto = require("crypto");
const Order = require("../../models/Order");
const Cart = require("../../models/Cart");
const Product = require("../../models/Product");
const Address = require("../../models/Address"); // ensure correct case

const RZP_KEY_ID = process.env.RAZORPAY_KEY_ID || "";
const RZP_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "";
const RZP_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || "";

let Razorpay = null;
if (RZP_KEY_ID && RZP_KEY_SECRET) {
  try { Razorpay = require("razorpay"); }
  catch { console.warn("Razorpay SDK not installed; run `npm i razorpay`."); }
}

const r2 = (n) => Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;

async function buildCheckoutContext(userId) {
  const cart = await Cart.findOne({ userId }).populate({
    path: "items.productId",
    model: "Product",
  });

  const items = [];
  const issues = [];
  if (!cart || !cart.items.length) {
    issues.push({ level: "error", code: "EMPTY_CART", message: "Your cart is empty." });
    return { items, subtotal: 0, issues };
  }

  for (const item of cart.items) {
    const p = item.productId;
    if (!p) { issues.push({ level: "error", code: "MISSING_PRODUCT", message: "One of your items is no longer available." }); continue; }
    if (p.isBlocked) { issues.push({ level: "error", code: "PRODUCT_BLOCKED", message: `${p.productName} is unavailable.` }); continue; }
    if (p.quantity < item.quantity) {
      issues.push({ level: "error", code: "OUT_OF_STOCK", message: `${p.productName} has only ${p.quantity} in stock.` });
      continue;
    }
    const unitPrice = Number(p.salePrice ?? p.regularPrice ?? 0);
    const lineTotal = unitPrice * item.quantity;
    items.push({
      productId: String(p._id),
      productName: p.productName,
      productNumber: p.productNumber,
      image: Array.isArray(p.productImage) && p.productImage[0] ? p.productImage[0] : null,
      color: item.selectedColor || p.color || "none",
      unitPrice,
      quantity: item.quantity,
      lineTotal,
    });
  }
  const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
  return { items, subtotal, issues };
}

function computeTotals({ subtotal, discountAmount = 0 }) {
  const shippingFee = subtotal >= 999 ? 0 : 49;
  const taxAmount = 0;
  const grandTotal = Math.max(0, subtotal - discountAmount + shippingFee + taxAmount);
  return { subtotal, discountAmount, shippingFee, taxAmount, grandTotal };
}

async function resolveShippingAddress(userId, { addressId, addressBody }) {
  if (addressId) {
    const doc = await Address.findOne({ userId, "address._id": addressId }, { "address.$": 1 });
    const a = doc?.address?.[0];
    if (!a) throw new Error("Selected address not found.");
    return { addressType: a.addressType, name: a.name, apartment: a.apartment, building: a.building, street: a.street, landmark: a.landmark, city: a.city, state: a.state, country: a.country, zip: a.zip, phone: a.phone, altPhone: a.altPhone };
  }
  if (addressBody) {
    const required = ["addressType","name","apartment","building","street","city","state","country","zip","phone"];
    for (const k of required) if (!addressBody[k]) throw new Error(`Address field "${k}" is required.`);
    return {
      addressType: addressBody.addressType,
      name: addressBody.name,
      apartment: addressBody.apartment,
      building: addressBody.building,
      street: addressBody.street,
      landmark: addressBody.landmark || "",
      city: addressBody.city,
      state: addressBody.state,
      country: addressBody.country,
      zip: addressBody.zip,
      phone: addressBody.phone,
      altPhone: addressBody.altPhone || "",
    };
  }
  throw new Error("Shipping address is required.");
}

async function decrementInventory(items, session) {
  for (const it of items) {
    const ok = await Product.findOneAndUpdate(
      { _id: it.productId, isBlocked: false, quantity: { $gte: it.quantity } },
      { $inc: { quantity: -it.quantity } },
      { new: true, session }
    );
    if (!ok) throw new Error(`Insufficient stock for ${it.productName}.`);
  }
}

function ensureRazorpay() {
  if (!RZP_KEY_ID || !RZP_KEY_SECRET || !Razorpay) {
    const msg = "Online payment not available. Please try COD.";
    const err = new Error(msg);
    err.status = 400;
    throw err;
  }
  return new Razorpay({ key_id: RZP_KEY_ID, key_secret: RZP_KEY_SECRET });
}

/* --------------------------------- CREATE (server) --------------------------------- */
// POST /create-order
exports.createRazorpayOrder = async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: "Login required." });
    const userId = req.user._id;

    // Build items & totals from cart
    const { items, subtotal, issues } = await buildCheckoutContext(userId);
    const blocking = issues.filter(i => i.level === "error");
    if (blocking.length) return res.status(400).json({ success: false, message: "Please fix cart issues.", issues });

    // Resolve address
    let shippingAddress;
    try {
      shippingAddress = await resolveShippingAddress(userId, {
        addressId: req.body.addressId,
        addressBody: req.body.addressBody,
      });
    } catch (e) {
      return res.status(400).json({ success: false, message: e.message });
    }

    const totals = computeTotals({ subtotal, discountAmount: 0 });

    // Create DB Order (pending)
    const orderDoc = new Order({
      userId,
      orderedItems: items.map(i => ({
        productId: i.productId,
        productName: i.productName,
        productNumber: i.productNumber,
        image: i.image,
        color: i.color,
        unitPrice: i.unitPrice,
        quantity: i.quantity,
        lineTotal: i.lineTotal,
      })),
      subtotal: totals.subtotal,
      discountAmount: totals.discountAmount,
      shippingFee: totals.shippingFee,
      taxAmount: totals.taxAmount,
      grandTotal: totals.grandTotal,
      totalPrice: totals.subtotal,
      finalAmount: totals.grandTotal,
      shippingAddress,
      orderStatus: "pending",
      payment: {
        method: "razorpay",
        paymentStatus: "pending",
        isPaid: false,
      },
      notes: req.body.note,
      placedAt: new Date(),
    });

    // Create Razorpay Order
    const instance = ensureRazorpay();
    const rzOrder = await instance.orders.create({
      amount: Math.round(totals.grandTotal * 100),
      currency: "INR",
      receipt: orderDoc.orderId || undefined,
      notes: { userId: String(userId), orderDbId: String(orderDoc._id) },
      // payment_capture: 1 // default auto-capture
    });

    // Save RZP order id
    orderDoc.payment.razorpayOrderId = rzOrder.id;
    orderDoc.razorpayOrderId = rzOrder.id; // compat mirror
    await orderDoc.save();

    return res.json({
      success: true,
      razorpay: {
        keyId: RZP_KEY_ID,
        orderId: rzOrder.id,
        amount: rzOrder.amount,
        currency: rzOrder.currency,
        name: "Aarohya",
        description: `Order ${orderDoc.orderId}`,
        prefill: {
          name: req.user.name || "",
          email: req.user.email || "",
          contact: shippingAddress.phone || "",
        },
        orderDbId: String(orderDoc._id),
      },
    });
  } catch (err) {
    const code = err.status || 500;
    return res.status(code).json({ success: false, message: err.message || "Could not create Razorpay order." });
  }
};

/* --------------------------------- VERIFY --------------------------------- */
// POST /verify
exports.verifyRazorpayPayment = async (req, res) => {
  const userId = req.user && req.user._id;
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      orderDbId,
    } = req.body || {};

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !orderDbId) {
      return res.status(400).json({ success: false, message: "Invalid verification payload." });
    }

    const order = await Order.findOne({ _id: orderDbId, userId });
    if (!order) return res.status(404).json({ success: false, message: "Order not found." });
    if (order.payment?.paymentStatus === "paid") {
      return res.json({ success: true, nextAction: "redirect", redirectUrl: `/order/success?orderId=${order._id}` });
    }
    if (order.payment?.razorpayOrderId !== razorpay_order_id) {
      return res.status(400).json({ success: false, message: "Razorpay Order mismatch." });
    }

    // 1) Verify signature
    const expected = crypto
      .createHmac("sha256", RZP_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");
    if (expected !== razorpay_signature) {
      return res.status(400).json({ success: false, message: "Signature verification failed." });
    }

    // 2) Fetch payment from Razorpay and validate
    const instance = ensureRazorpay();
    const payment = await instance.payments.fetch(razorpay_payment_id);
    if (!payment) return res.status(400).json({ success: false, message: "Payment not found at Razorpay." });

    // Validate status and amounts/currency and linkage
    if (payment.status !== "captured" && payment.status !== "authorized") {
      return res.status(400).json({ success: false, message: `Payment status not captured/authorized (${payment.status}).` });
    }
    if (payment.order_id !== razorpay_order_id) {
      return res.status(400).json({ success: false, message: "Payment linked to a different order." });
    }
    const expectedAmount = Math.round(order.grandTotal * 100);
    if (Number(payment.amount) !== expectedAmount || payment.currency !== "INR") {
      return res.status(400).json({ success: false, message: "Payment amount/currency mismatch." });
    }

    // 3) Idempotent claim of paymentId (prevents double processing)
    const claimed = await Order.findOneAndUpdate(
      {
        _id: order._id,
        userId,
        "payment.razorpayPaymentId": { $exists: false },
      },
      {
        $set: {
          "payment.razorpayPaymentId": razorpay_payment_id,
          "payment.razorpaySignature": razorpay_signature,
        },
      },
      { new: true }
    );
    const ord = claimed || order; // if already claimed, proceed

    // 4) Inventory & finalization (transaction)
    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      await decrementInventory(
        ord.orderedItems.map(i => ({ productId: i.productId, productName: i.productName, quantity: i.quantity })),
        session
      );

      ord.payment.paymentStatus = "paid";
      ord.payment.isPaid = true;
      ord.paidAt = new Date();
      ord.orderStatus = "processing";
      await ord.save({ session });

      await Cart.updateOne({ userId }, { $set: { items: [], discount: 0 } }, { session });

      await session.commitTransaction();
      session.endSession();

      return res.json({ success: true, nextAction: "redirect", redirectUrl: `/order/success?orderId=${ord._id}` });
    } catch (e) {
      await session.abortTransaction().catch(() => {});
      session.endSession();

      // Inventory failed AFTER capture → initiate refund
      try {
        const refund = await instance.payments.refund(razorpay_payment_id, { amount: expectedAmount, speed: "normal" });
        await Order.updateOne(
          { _id: ord._id },
          {
            $set: {
              "payment.paymentStatus": "refunded",
              orderStatus: "cancelled",
              cancelReason: "Auto-refund: inventory unavailable after payment.",
            },
            $push: {
              "payment.refunds": {
                refundId: refund.id,
                amount: refund.amount,
                status: refund.status,
                createdAt: new Date(),
                notes: refund.notes || {},
              },
            },
          }
        );
      } catch (re) {
        await Order.updateOne(
          { _id: ord._id },
          {
            $set: {
              "payment.paymentStatus": "failed",
              orderStatus: "pending",
            },
          }
        );
      }

      return res.status(400).json({ success: false, message: e.message || "Payment captured but stock unavailable. Refunded." });
    }
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Verify failed." });
  }
};

/* --------------------------------- RETRY / REPAY --------------------------------- */
// GET /checkout/pay/:orderId
exports.repayWithNewRazorpayOrder = async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: "Login required." });
    const userId = req.user._id;
    const orderId = req.params.orderId;

    const order = await Order.findOne({ _id: orderId, userId });
    if (!order) return res.status(404).json({ success: false, message: "Order not found." });
    if (order.payment?.paymentStatus === "paid") {
      return res.json({ success: true, nextAction: "redirect", redirectUrl: `/order/success?orderId=${order._id}` });
    }

    const instance = ensureRazorpay();
    const rzOrder = await instance.orders.create({
      amount: Math.round(order.grandTotal * 100),
      currency: "INR",
      receipt: order.orderId || undefined,
      notes: { userId: String(userId), orderDbId: String(order._id), retry: "1" },
    });

    order.payment.razorpayOrderId = rzOrder.id;
    order.razorpayOrderId = rzOrder.id; // compat
    await order.save();

    return res.json({
      success: true,
      razorpay: {
        keyId: RZP_KEY_ID,
        orderId: rzOrder.id,
        amount: rzOrder.amount,
        currency: rzOrder.currency,
        name: "Aarohya",
        description: `Order ${order.orderId}`,
        prefill: {
          name: req.user.name || "",
          email: req.user.email || "",
          contact: order?.shippingAddress?.phone || "",
        },
        orderDbId: String(order._id),
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Could not create retry order." });
  }
};

/* --------------------------------- WEBHOOK --------------------------------- */
// POST /razorpay/webhook
exports.razorpayWebhook = async (req, res) => {
  try {
    // Razorpay signs the RAW body; ensure your app uses raw body parser for this route.
    const signature = req.headers["x-razorpay-signature"];
    const body = req.rawBody || req.body; // prefer raw string; else JSON stringifying must match
    const payload = typeof body === "string" ? body : JSON.stringify(body);

    if (!RZP_WEBHOOK_SECRET) return res.status(400).send("Webhook secret not configured.");

    const expected = crypto.createHmac("sha256", RZP_WEBHOOK_SECRET).update(payload).digest("hex");
    if (expected !== signature) return res.status(401).send("Invalid webhook signature.");

    const evt = typeof body === "string" ? JSON.parse(body) : body;
    const type = evt?.event;
    const entity = evt?.payload?.payment?.entity || evt?.payload?.refund?.entity || null;

    const instance = ensureRazorpay();

    if (type === "payment.captured" || type === "payment.authorized") {
      const payment = entity;
      const rzOrderId = payment.order_id;
      const rzPaymentId = payment.id;

      const order = await Order.findOne({ "payment.razorpayOrderId": rzOrderId });
      if (!order) return res.status(200).send("OK");

      // Idempotent claim
      const claimed = await Order.findOneAndUpdate(
        { _id: order._id, "payment.razorpayPaymentId": { $exists: false } },
        {
          $set: {
            "payment.razorpayPaymentId": rzPaymentId,
            "payment.razorpaySignature": "(webhook)",
          },
        },
        { new: true }
      );
      const ord = claimed || order;

      // If already paid, exit
      if (ord.payment?.paymentStatus === "paid") return res.status(200).send("OK");

      // Validate amount/currency
      const expectedAmount = Math.round(ord.grandTotal * 100);
      if (Number(payment.amount) !== expectedAmount || payment.currency !== "INR") {
        // amount mismatch → mark failed & refund
        try {
          const refund = await instance.payments.refund(rzPaymentId, { amount: payment.amount, speed: "normal" });
          await Order.updateOne(
            { _id: ord._id },
            {
              $set: { "payment.paymentStatus": "refunded", orderStatus: "cancelled", cancelReason: "Webhook refund (amount mismatch)." },
              $push: { "payment.refunds": { refundId: refund.id, amount: refund.amount, status: refund.status, createdAt: new Date(), notes: refund.notes || {} } },
            }
          );
        } catch {}
        return res.status(200).send("OK");
      }

      // Try inventory + finalize
      const session = await mongoose.startSession();
      try {
        session.startTransaction();
        await decrementInventory(
          ord.orderedItems.map(i => ({ productId: i.productId, productName: i.productName, quantity: i.quantity })),
          session
        );
        ord.payment.paymentStatus = "paid";
        ord.payment.isPaid = true;
        ord.paidAt = new Date();
        ord.orderStatus = "processing";
        await ord.save({ session });
        await Cart.updateOne({ userId: ord.userId }, { $set: { items: [], discount: 0 } }, { session });
        await session.commitTransaction();
        session.endSession();
      } catch (e) {
        await session.abortTransaction().catch(() => {});
        session.endSession();
        try {
          const refund = await instance.payments.refund(rzPaymentId, { amount: expectedAmount, speed: "normal" });
          await Order.updateOne(
            { _id: ord._id },
            {
              $set: { "payment.paymentStatus": "refunded", orderStatus: "cancelled", cancelReason: "Auto-refund: inventory unavailable (webhook)." },
              $push: { "payment.refunds": { refundId: refund.id, amount: refund.amount, status: refund.status, createdAt: new Date(), notes: refund.notes || {} } },
            }
          );
        } catch {}
      }

      return res.status(200).send("OK");
    }

    if (type === "payment.failed") {
      const payment = entity;
      const rzOrderId = payment?.order_id;
      if (!rzOrderId) return res.status(200).send("OK");
      await Order.updateOne(
        { "payment.razorpayOrderId": rzOrderId },
        { $set: { "payment.paymentStatus": "failed", orderStatus: "pending" } }
      );
      return res.status(200).send("OK");
    }

    if (type === "refund.processed") {
      const refund = entity;
      const rzPaymentId = refund?.payment_id;
      if (!rzPaymentId) return res.status(200).send("OK");
      await Order.updateOne(
        { "payment.razorpayPaymentId": rzPaymentId },
        { $push: { "payment.refunds": { refundId: refund.id, amount: refund.amount, status: refund.status, createdAt: new Date(), notes: refund.notes || {} } } }
      );
      return res.status(200).send("OK");
    }

    return res.status(200).send("OK");
  } catch (err) {
    return res.status(200).send("OK"); // keep webhook idempotent; log internally if needed
  }
};
