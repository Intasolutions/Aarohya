// controllers/shop/orderController.js
const mongoose = require("mongoose");
const path = require("path");
const Order = require("../../models/Order");
const Address = require("../../models/address"); // keep your existing address model casing
const Payout = require("../../models/Payout");

/* ------------------------- helpers ------------------------- */

function currency(n) {
  const num = Number(n || 0);
  return Math.round(num);
}

function normalizeOrder(orderDoc) {
  const o = orderDoc || {};

  const items = (o.items || o.orderedItems || []).map((it) => {
    const p = it.product || it.productId || {};
    const name = it.productName || p.productName || "Product";
    const img =
      it.image ||
      it.productImage ||
      (Array.isArray(p.productImage) ? p.productImage[0] : undefined) ||
      "img/bg-img/cart1.jpg";
    const color = it.color || p.color || "";
    const qty = Number(it.quantity || 1);
    const unit =
      it.unitPrice ?? it.price ?? it.priceAtAdd ?? p.salePrice ?? p.regularPrice ?? 0;
    const total = (it.lineTotal != null) ? Number(it.lineTotal) : (unit * qty);
    const id = p._id || it.productId || null;
    return { id, name, img, color, qty, unit: Number(unit || 0), total: Number(total || 0) };
  });

  const subtotal =
    o.subtotal ??
    (o.totals && o.totals.subtotal) ??
    o.totalPrice ??
    items.reduce((s, i) => s + i.total, 0);

  const discount =
    o.discountAmount ??
    (o.totals && o.totals.discountAmount) ??
    o.discount ??
    0;

  const shipping =
    o.shippingFee ??
    (o.totals && o.totals.shippingFee) ??
    0;

  const tax =
    o.taxAmount ??
    (o.totals && (o.totals.tax ?? o.totals.taxAmount)) ??
    o.tax ??
    0;

  const grand =
    o.grandTotal ??
    (o.totals && o.totals.grandTotal) ??
    o.finalAmount ??
    o.amount ??
    (subtotal - discount + shipping + tax);

  const address = o.shippingAddress || o.address || {};

  const meta = {
    orderId: o.orderId || String(o._id || ""),
    status: o.orderStatus || o.status || "pending",
    paymentStatus: (o.payment && o.payment.paymentStatus) || o.paymentStatus || "pending",
    paymentMethod: (o.payment && o.payment.method) || o.paymentMethod || "-",
    razorpayOrderId: (o.payment && o.payment.razorpayOrderId) || o.razorpayOrderId || "",
    couponApplied: !!o.couponApplied,
    createdAt: o.createdAt || new Date(),
    placedAt: o.placedAt || o.createdAt || null,
    shippedAt: o.shippedAt || null,
    deliveredAt: o.deliveredAt || null,
    updatedAt: o.updatedAt || o.createdAt || new Date(),
  };

  return {
    meta,
    items,
    totals: {
      subtotal: currency(subtotal),
      discount: currency(discount),
      shipping: currency(shipping),
      tax: currency(tax),
      grand: currency(grand),
    },
    address,
    raw: o,
  };
}

/* ---------- OrderID helper (in-file, no extra models) ---------- */
/** Generates IDs like: ORD-YYYYMMDD-#### (IST date, per-process sequence) */
let __lastScope = "";
let __seq = 0;
function makeOrderIdIST(now = new Date()) {
  const istOffsetMin = 330; // IST = UTC+5:30
  const d = new Date(now.getTime() + istOffsetMin * 60 * 1000);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const scope = `${yyyy}${mm}${dd}`; // YYYYMMDD (IST)

  if (scope !== __lastScope) {
    __lastScope = scope;
    __seq = 0;
  }
  __seq += 1;
  const seqStr = String(__seq).padStart(4, "0");
  return `ORD-${scope}-${seqStr}`;
}

/* ------------------------- list orders ------------------------- */

exports.listOrders = async (req, res, next) => {
  try {
    if (!req.user) return res.redirect("/auth/login");

    const userId = req.user._id;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(24, Math.max(1, parseInt(req.query.limit) || 10));
    const status = (req.query.status || "").trim();
    const q = (req.query.q || "").trim();

    const filter = { userId };
    if (status) filter.orderStatus = new RegExp(`^${status}$`, "i");

    if (q) {
      const esc = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(esc, "i");
      filter.$or = [
        { orderId: re },
        { "items.productName": re },
        { "items.product.productName": re },
        { "orderedItems.productName": re },
        { "orderedItems.product.productName": re },
      ];
    }

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Order.countDocuments(filter),
    ]);

    const normOrders = orders.map(o => normalizeOrder(o));
    const totalPages = Math.max(1, Math.ceil(total / limit));

    res.render("shop/orders", {
      user: req.user,
      orders: normOrders,
      page,
      totalPages,
      total,
      limit,
      filters: { status, q },
    });
  } catch (err) {
    next(err);
  }
};

/* ------------------------- order details ------------------------- */

exports.getOrderDetails = async (req, res, next) => {
  try {
    if (!req.user) return res.redirect("/auth/login");
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) return res.redirect("/orders");

    // Enforce ownership
    const order = await Order.findOne({ _id: id, userId: req.user._id }).lean();
    if (!order) return res.status(404).render("shop/orderDetails", { notFound: true });

    const norm = normalizeOrder(order);

    // Payout for COD refund UI (customer view)
    let payout = null;
    try {
      payout = await Payout.findOne({ orderId: order._id, userId: req.user._id }).lean();
    } catch {}

    res.render("shop/orderDetails", {
      user: req.user,
      order,
      norm,
      payout: payout || null,
      error: req.query.err || "",
      ok: req.query.ok || ""
    });
  } catch (err) {
    next(err);
  }
};

/* ------------------------- invoice page ------------------------- */

exports.getInvoice = async (req, res, next) => {
  try {
    if (!req.user) return res.redirect("/auth/login");

    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) return res.redirect("/orders");

    const order = await Order.findOne({ _id: id, userId: req.user._id }).lean();
    if (!order) return res.status(404).render("shop/invoice", { notFound: true });

    const norm = normalizeOrder(order);

    res.render("shop/invoice", {
      user: req.user,
      order,
      norm,
      company: {
        name: "Aarohya",
        email: "support@aarohya.example",
        phone: "+91 90000 00000",
        address: "No. 42, MG Road, Bengaluru, KA 560001",
        gstin: "29ABCDE1234F1Z5",
      },
    });
  } catch (err) {
    next(err);
  }
};

/* ------------------------- place order ------------------------- */

const r2 = (n) => Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;

function pickCheckoutItems(req) {
  if (Array.isArray(req.body.items) && req.body.items.length) return req.body.items;
  if (req.session && Array.isArray(req.session.checkoutItems) && req.session.checkoutItems.length) {
    return req.session.checkoutItems;
  }
  if (req.session && req.session.cart && Array.isArray(req.session.cart.items) && req.session.cart.items.length) {
    return req.session.cart.items;
  }
  if (req.session && Array.isArray(req.session.cart) && req.session.cart.length) {
    return req.session.cart;
  }
  return null;
}

function mapToOrderedItems(rawItems) {
  const COLOR_ENUM = ["Silver","Gold","Rose Gold","none"];
  return rawItems.map((it) => {
    const productId = it.productId || it.id || (it.product && it.product._id);
    if (!productId) throw new Error("Item missing productId");

    const productName = it.productName || (it.product && it.product.productName) || "Product";
    const unitPrice = Number(it.unitPrice ?? it.price ?? it.salePrice ?? it.regularPrice ?? 0);
    const quantity  = Number(it.quantity || it.qty || 1);
    const lineTotal = r2(unitPrice * quantity);
    const image     = it.image || (Array.isArray(it.productImage) ? it.productImage[0] : "") || "";
    const color     = COLOR_ENUM.includes(it.color) ? it.color : "none";

    return { productId, productName, image, color, unitPrice, quantity, lineTotal, productStatus: "active" };
  });
}

async function loadSavedAddressSnapshot(userId, addressId) {
  const doc = await Address.findOne(
    { userId, "address._id": addressId },
    { "address.$": 1 }
  ).lean();

  if (!doc || !doc.address || !doc.address.length) {
    throw new Error("Saved address not found");
  }
  const a = doc.address[0];
  return {
    addressType: a.addressType,
    name:        a.name,
    apartment:   a.apartment,
    building:    a.building,
    street:      a.street,
    landmark:    a.landmark || "",
    city:        a.city,
    state:       a.state,
    country:     a.country,
    zip:         a.zip,
    phone:       a.phone,
    altPhone:    a.altPhone || "",
  };
}

exports.placeOrder = async (req, res) => {
  try {
    if (!req.user) return res.redirect("/auth/login");
    const userId = req.user._id;

    const rawItems = pickCheckoutItems(req);
    if (!rawItems || !rawItems.length) throw new Error("No items to place order");
    const orderedItems = mapToOrderedItems(rawItems);

    let shippingAddress;
    const addrId = req.body.addressId;
    if (addrId) {
      if (!mongoose.isValidObjectId(addrId)) throw new Error("Invalid address selected");
      shippingAddress = await loadSavedAddressSnapshot(userId, addrId);
    } else if (req.body.shippingAddress) {
      const b = req.body.shippingAddress;
      shippingAddress = {
        addressType: b.addressType,
        name:        b.name,
        apartment:   b.apartment,
        building:    b.building,
        street:      b.street,
        landmark:    b.landmark || "",
        city:        b.city,
        state:       b.state,
        country:     b.country,
        zip:         b.zip,
        phone:       b.phone,
        altPhone:    b.altPhone || "",
      };
    } else {
      throw new Error("No address provided");
    }

    const allowed = ["cod","wallet","razorpay","online","online payment"];
    const method = (req.body.paymentMethod || "").toLowerCase();
    if (!allowed.includes(method)) throw new Error("Invalid payment method");
    const payment = { method, paymentStatus: "pending", isPaid: false };

    const subtotal       = r2(orderedItems.reduce((s, i) => s + i.lineTotal, 0));
    const discountAmount = r2(Number(req.body.discountAmount || 0));
    const shippingFee    = r2(Number(req.body.shippingFee || 0));
    const taxAmount      = r2(Number(req.body.taxAmount || 0));
    const grandTotal     = r2(subtotal - discountAmount + shippingFee + taxAmount);

    const order = new Order({
      userId,
      orderedItems,
      shippingAddress,
      payment,
      subtotal,
      discountAmount,
      shippingFee,
      taxAmount,
      grandTotal,
      orderStatus: "pending",
      notes: (req.body.note || "").slice(0, 1000),
      couponApplied: !!req.body.couponCode,
      couponCode: req.body.couponCode || undefined,
      // structured per-day IST sequence
      orderId: makeOrderIdIST()
    });

    await order.save();

    if (req.session) {
      delete req.session.checkoutItems;
      if (req.session.cart) delete req.session.cart;
    }

    return res.redirect("/orders");
  } catch (err) {
    console.error("PLACE_ORDER_ERR:", err && err.stack ? err.stack : err);
    return res.status(400).send("Could not place order: " + err.message);
  }
};

/* ------------------------- USER RETURNS (form + submit) ------------------------- */

function isReturnEligible(order, windowDays = 7) {
  if (!order) return { ok: false, msg: "Order not found" };
  if (String(order.orderStatus).toLowerCase() !== "delivered") {
    return { ok: false, msg: "Only delivered orders can be returned" };
  }
  if (!order.deliveredAt) {
    return { ok: false, msg: "Delivered timestamp missing" };
  }
  const now = Date.now();
  const deadline = new Date(order.deliveredAt).getTime() + windowDays * 24 * 60 * 60 * 1000;
  if (now > deadline) {
    return { ok: false, msg: `Return window (within ${windowDays} days) has expired` };
  }
  if (order.returnRequest && order.returnRequest.status && order.returnRequest.status !== "none") {
    return { ok: false, msg: "There is already a return request in progress for this order" };
  }
  return { ok: true };
}

function coerceItemsPayload(bodyItems) {
  if (!bodyItems) return [];
  if (Array.isArray(bodyItems)) return bodyItems;

  const out = [];
  Object.keys(bodyItems).forEach(k => {
    const v = bodyItems[k];
    if (!v) return;
    const selected = String(v.selected || "").trim() === "1";
    const pid = v.productId || v.id;
    const qty = v.quantity;
    if (selected && pid) out.push({ productId: pid, quantity: qty });
  });
  return out;
}

function validateReturnItems(order, payloadItems) {
  const err = (msg) => ({ ok: false, msg });
  if (!Array.isArray(payloadItems) || !payloadItems.length) {
    return err("Select at least one item to return");
  }

  const byId = new Map();
  (order.orderedItems || []).forEach(it => byId.set(String(it.productId), it));

  const normalized = [];
  for (const raw of payloadItems) {
    const pid = String(raw.productId || "").trim();
    const qty = Math.max(1, Number(raw.quantity || 0));
    if (!pid || !byId.has(pid)) return err("Invalid product in request");
    const it = byId.get(pid);
    const st = String(it.productStatus || "").toLowerCase();
    if (st === "cancelled" || st === "returned") {
      return err(`Item "${it.productName}" is not eligible for return`);
    }
    if (qty > Number(it.quantity || 0)) {
      return err(`Quantity for "${it.productName}" exceeds purchased quantity`);
    }
    normalized.push({
      productId: it.productId,
      productName: it.productName,
      quantity: qty,
      unitPrice: Number(it.unitPrice || 0),
      lineTotal: Math.round((Number(it.unitPrice || 0) * qty + Number.EPSILON) * 100) / 100
    });
  }
  return { ok: true, items: normalized };
}

// GET /orders/:id/return
exports.getReturnForm = async (req, res, next) => {
  try {
    if (!req.user) return res.redirect("/auth/login");
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) return res.redirect("/orders");

    const order = await Order.findOne({ _id: id, userId: req.user._id }).lean();
    if (!order) return res.redirect("/orders");

    const elig = isReturnEligible(order);
    if (!elig.ok) {
      return res.status(400).render("shop/return", {
        user: req.user,
        order,
        eligible: false,
        reason: elig.msg,
        items: [],
      });
    }

    const items = (order.orderedItems || [])
      .filter(it => String(it.productStatus).toLowerCase() === "active")
      .map(it => ({
        id: String(it.productId),
        name: it.productName,
        img: it.image,
        color: it.color,
        qty: it.quantity,
        unit: it.unitPrice,
      }));

    return res.render("shop/return", {
      user: req.user,
      order,
      eligible: true,
      reason: "",
      items
    });
  } catch (err) {
    next(err);
  }
};

// POST /orders/:id/return
exports.submitReturn = async (req, res) => {
  try {
    if (!req.user) return res.redirect("/auth/login");
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) return res.redirect("/orders");

    const order = await Order.findOne({ _id: id, userId: req.user._id });
    if (!order) return res.redirect("/orders");

    const elig = isReturnEligible(order);
    if (!elig.ok) {
      return res.status(400).send(elig.msg);
    }

    const reason = (req.body.reason || "").trim().slice(0, 200);
    const description = (req.body.description || "").trim().slice(0, 1000);
    const itemsPayload = coerceItemsPayload(req.body.items);
    const v = validateReturnItems(order.toObject(), itemsPayload);
    if (!v.ok) return res.status(400).send(v.msg);

    const MAX_FILES = 5;
    const files = Array.isArray(req.files) ? req.files.slice(0, MAX_FILES) : [];
    const imagePaths = files.map(f => (f.path ? f.path.split(path.sep).join("/") : "")).filter(Boolean);

    order.returnRequest = {
      status: "pending",
      reason,
      description,
      images: imagePaths,
      requestedAt: new Date(),
      reviewedAt: null,
      rejectionReason: null,
      rejectionCategory: null,
      items: v.items,
    };
    order.orderStatus = "return_requested";

    await order.save();

    return res.redirect(`/orders/${order._id}`);
  } catch (err) {
    console.error("SUBMIT_RETURN_ERR:", err && err.stack ? err.stack : err);
    return res.status(400).send("Could not submit return request: " + err.message);
  }
};

/* ------------------------- explicit export map (fix for routes) ------------------------- */
module.exports = {
  listOrders: exports.listOrders,
  getOrderDetails: exports.getOrderDetails,
  getInvoice: exports.getInvoice,
  placeOrder: exports.placeOrder,
  getReturnForm: exports.getReturnForm,
  submitReturn: exports.submitReturn,
};
