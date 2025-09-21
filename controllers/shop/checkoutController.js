// controllers/shop/checkoutController.js
const mongoose = require("mongoose");
const crypto = require("crypto");
const Cart = require("../../models/Cart");
const Product = require("../../models/Product");
const Address = require("../../models/Address");
const Order = require("../../models/Order");

const RZP_KEY_ID = process.env.RAZORPAY_KEY_ID || "";
const RZP_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "";

/** Optional Razorpay lazy import (keeps COD working without keys) */
let Razorpay = null;
if (RZP_KEY_ID && RZP_KEY_SECRET) {
  try {
    Razorpay = require("razorpay");
  } catch (e) {
    console.warn("Razorpay SDK not installed; run `npm i razorpay` to enable online payments.");
  }
}

/* ----------------------------- helpers ----------------------------- */

/** computes totals & validation issues for a user's cart (server-source of truth) */
async function buildCheckoutContext(userId) {
  const cart = await Cart.findOne({ userId }).populate({
    path: "items.productId",
    model: "Product",
  });

  if (!cart || !cart.items.length) {
    return { items: [], subtotal: 0, issues: [{ level: "error", code: "EMPTY_CART", message: "Your cart is empty." }] };
  }

  const items = [];
  const issues = [];

  for (const item of cart.items) {
    const p = item.productId;
    if (!p) {
      issues.push({ level: "error", code: "MISSING_PRODUCT", message: "One of your items is no longer available.", itemId: String(item._id) });
      continue;
    }
    if (p.isBlocked) {
      issues.push({ level: "error", code: "PRODUCT_BLOCKED", message: `${p.productName} is currently unavailable.`, productId: String(p._id) });
      continue;
    }
    if (p.quantity < item.quantity) {
      issues.push({
        level: "error",
        code: "OUT_OF_STOCK",
        message: `${p.productName} has only ${p.quantity} left in stock.`,
        productId: String(p._id),
        available: p.quantity,
        requested: item.quantity,
      });
      continue;
    }

    const currentUnitPrice = Number(p.salePrice ?? p.regularPrice ?? 0);
    const lineTotal = currentUnitPrice * item.quantity;

    if (item.priceAtAdd != null && Number(item.priceAtAdd) !== currentUnitPrice) {
      issues.push({
        level: "warn",
        code: "PRICE_CHANGED",
        message: `Price updated for ${p.productName}.`,
        productId: String(p._id),
        oldPrice: Number(item.priceAtAdd),
        newPrice: currentUnitPrice,
      });
    }

    items.push({
      cartItemId: String(item._id),
      productId: String(p._id),
      productName: p.productName,
      productNumber: p.productNumber,
      image: Array.isArray(p.productImage) && p.productImage.length ? p.productImage[0] : null,
      color: item.selectedColor || p.color || "none",
      unitPrice: currentUnitPrice,
      quantity: item.quantity,
      lineTotal,
    });
  }

  const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);

  return { items, subtotal, issues };
}

/** simple pricing rules (customize as needed) */
function computeTotals({ subtotal, discountAmount = 0 }) {
  const shippingFee = subtotal >= 999 ? 0 : 49;
  const taxAmount = 0; // add GST/VAT if needed
  const grandTotal = Math.max(0, subtotal - discountAmount + shippingFee + taxAmount);
  return { subtotal, discountAmount, shippingFee, taxAmount, grandTotal };
}

/** fetch & snapshot a user's address by subdoc id OR validate inline address body */
async function resolveShippingAddress(userId, { addressId, addressBody }) {
  if (addressId) {
    const doc = await Address.findOne({ userId, "address._id": addressId }, { "address.$": 1 });
    const a = doc?.address?.[0];
    if (!a) throw new Error("Selected address not found.");
    // Ensure all required fields exist (your schema requires all)
    return {
      addressType: a.addressType,
      name: a.name,
      apartment: a.apartment,
      building: a.building,
      street: a.street,
      landmark: a.landmark,
      city: a.city,
      state: a.state,
      country: a.country,
      zip: a.zip,
      phone: a.phone,
      altPhone: a.altPhone,
    };
  }

  if (addressBody) {
    const required = ["addressType","name","apartment","building","street","landmark","city","state","country","zip","phone","altPhone"];
    for (const k of required) {
      if (!addressBody[k]) throw new Error(`Address field "${k}" is required.`);
    }
    return addressBody;
  }

  throw new Error("Shipping address is required.");
}

/** atomically decrement stock for all items (with session) */
async function decrementInventory(items, session) {
  for (const it of items) {
    const updated = await Product.findOneAndUpdate(
      { _id: it.productId, isBlocked: false, quantity: { $gte: it.quantity } },
      { $inc: { quantity: -it.quantity } },
      { new: true, session }
    );
    if (!updated) {
      throw new Error(`Insufficient stock for ${it.productName}.`);
    }
  }
}

/* ----------------------------- controllers ----------------------------- */

// GET /checkout
exports.getCheckout = async (req, res, next) => {
  try {
    if (!req.user) return res.redirect("/auth/login");

    const userId = req.user._id;
    const { items, subtotal, issues } = await buildCheckoutContext(userId);

    if (!items.length) {
      // No purchasable items; render with issues (or redirect to cart)
      return res.render("shop/checkout", {
        user: req.user,
        addresses: (await Address.findOne({ userId }))?.address || [],
        items,
        totals: computeTotals({ subtotal }),
        issues,
        paymentKeyId: RZP_KEY_ID || null,
      });
    }

    const totals = computeTotals({ subtotal });

    res.render("shop/checkout", {
      user: req.user,
      addresses: (await Address.findOne({ userId }))?.address || [],
      items,
      totals,
      issues,
      paymentKeyId: RZP_KEY_ID || null,
    });
  } catch (err) {
    next(err);
  }
};

// POST /checkout/validate
exports.validateCheckout = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { items, subtotal, issues } = await buildCheckoutContext(userId);
    const totals = computeTotals({ subtotal });

    const hasBlocking = issues.some(i => i.level === "error");
    res.status(hasBlocking ? 400 : 200).json({ success: !hasBlocking, items, totals, issues });
  } catch (err) {
    next(err);
  }
};

// POST /checkout/place-order
// body: { addressId? OR addressBody?, paymentMethod: 'cod'|'razorpay'|'wallet', note?, couponCode? }
exports.placeOrder = async (req, res, next) => {
  const userId = req.user._id;

  try {
    const { items, subtotal, issues } = await buildCheckoutContext(userId);
    const blocking = issues.filter(i => i.level === "error");
    if (blocking.length) {
      return res.status(400).json({ success: false, message: "Please resolve cart issues before checkout.", issues });
    }

    const paymentMethod = (req.body.paymentMethod || "").toLowerCase();
    if (!["cod", "razorpay", "wallet", "online", "online payment"].includes(paymentMethod)) {
      return res.status(400).json({ success: false, message: "Invalid payment method." });
    }

    // Address
    let shippingAddress;
    try {
      shippingAddress = await resolveShippingAddress(userId, { addressId: req.body.addressId, addressBody: req.body.addressBody });
    } catch (e) {
      return res.status(400).json({ success: false, message: e.message });
    }

    // Totals
    const discountAmount = 0; // plug coupon logic if needed
    const totals = computeTotals({ subtotal, discountAmount });

    // Build base order (do not reduce inventory yet for online payments)
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

      // legacy mirrors for compatibility
      totalPrice: totals.subtotal,
      finalAmount: totals.grandTotal,

      shippingAddress,
      orderStatus: "pending",
      payment: {
        method: paymentMethod === "online" ? "online payment" : paymentMethod,
        paymentStatus: paymentMethod === "cod" ? "pending" : "pending",
      },
      notes: req.body.note,
      placedAt: new Date(),
    });

    // COD: lock inventory + place immediately
    if (paymentMethod === "cod") {
      const session = await mongoose.startSession();
      try {
        session.startTransaction();

        await decrementInventory(items, session);
        await orderDoc.save({ session });

        // clear cart
        await Cart.updateOne({ userId }, { $set: { items: [], discount: 0 } }, { session });

        await session.commitTransaction();
        session.endSession();

        return res.json({ success: true, nextAction: "redirect", redirectUrl: `/order/success?orderId=${orderDoc._id}` });
      } catch (e) {
        await session.abortTransaction().catch(() => {});
        session.endSession();
        return res.status(400).json({ success: false, message: e.message });
      }
    }

    // Razorpay: create gateway order and return client config
    if (paymentMethod === "razorpay" || paymentMethod === "online" || paymentMethod === "online payment") {
      if (!RZP_KEY_ID || !RZP_KEY_SECRET || !Razorpay) {
        return res.status(400).json({ success: false, message: "Online payment not available. Please choose COD." });
      }

      const instance = new Razorpay({ key_id: RZP_KEY_ID, key_secret: RZP_KEY_SECRET });

      const rzOrder = await instance.orders.create({
        amount: Math.round(totals.grandTotal * 100),
        currency: "INR",
        receipt: orderDoc.orderId || undefined,
        notes: { userId: String(userId) },
      });

      orderDoc.payment.razorpayOrderId = rzOrder.id;
      orderDoc.razorpayOrderId = rzOrder.id;

      await orderDoc.save();

      return res.json({
        success: true,
        nextAction: "pay",
        razorpay: {
          keyId: RZP_KEY_ID,
          orderId: rzOrder.id,
          amount: rzOrder.amount,
          currency: rzOrder.currency,
          name: "Checkout",
          description: `Order ${orderDoc.orderId}`,
          prefill: {
            name: req.user.name || "",
            email: req.user.email || "",
            contact: shippingAddress.phone || "",
          },
          // You will call /checkout/razorpay/verify afterwards
          orderDbId: String(orderDoc._id),
        },
      });
    }

    // Wallet flow placeholder (if you add a wallet)
    if (paymentMethod === "wallet") {
      return res.status(400).json({ success: false, message: "Wallet payments not implemented yet." });
    }

    return res.status(400).json({ success: false, message: "Unsupported payment method." });
  } catch (err) {
    next(err);
  }
};

// POST /checkout/razorpay/verify
// body: { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderDbId }
exports.verifyRazorpay = async (req, res, next) => {
  const userId = req.user._id;

  try {
    if (!RZP_KEY_SECRET) {
      return res.status(400).json({ success: false, message: "Gateway not configured." });
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderDbId } = req.body || {};
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !orderDbId) {
      return res.status(400).json({ success: false, message: "Invalid payment verification payload." });
    }

    // verify signature
    const expected = crypto.createHmac("sha256", RZP_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expected !== razorpay_signature) {
      return res.status(400).json({ success: false, message: "Payment signature verification failed." });
    }

    const order = await Order.findOne({ _id: orderDbId, userId });
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found." });
    }
    if (order.payment?.paymentStatus === "paid") {
      return res.json({ success: true, nextAction: "redirect", redirectUrl: `/order/success?orderId=${order._id}` });
    }

    // Re-validate inventory and decrement now (payment is confirmed)
    const items = order.orderedItems.map(i => ({
      productId: i.productId,
      productName: i.productName,
      quantity: i.quantity,
    }));

    const session = await mongoose.startSession();
    try {
      session.startTransaction();

      await decrementInventory(items, session);

      order.payment.paymentStatus = "paid";
      order.payment.isPaid = true;
      order.payment.razorpayPaymentId = razorpay_payment_id;
      order.paidAt = new Date();
      order.orderStatus = "processing";

      await order.save({ session });

      // clear cart
      await Cart.updateOne({ userId }, { $set: { items: [], discount: 0 } }, { session });

      await session.commitTransaction();
      session.endSession();

      return res.json({ success: true, nextAction: "redirect", redirectUrl: `/order/success?orderId=${order._id}` });
    } catch (e) {
      await session.abortTransaction().catch(() => {});
      session.endSession();

      // mark payment as failed/refund-required
      order.payment.paymentStatus = "failed";
      order.orderStatus = "pending";
      await order.save().catch(() => {});

      return res.status(400).json({ success: false, message: e.message || "Payment captured, but stock unavailable. We’ll refund shortly." });
    }
  } catch (err) {
    next(err);
  }
};

// GET /order/success
exports.orderSuccess = async (req, res, next) => {
  try {
    const orderId = req.query.orderId;
    const order = await Order.findOne({ _id: orderId, userId: req.user._id });
    if (!order) return res.redirect("/orders");
    res.render("shop/order-success", { order });
  } catch (err) {
    next(err);
  }
};

// GET /order/failure
exports.orderFailure = async (req, res, next) => {
  try {
    const orderId = req.query.orderId;
    const order = await Order.findOne({ _id: orderId, userId: req.user._id }).lean();
    res.render("shop/order-failure", { order, message: "Your payment could not be completed." });
  } catch (err) {
    next(err);
  }
};
