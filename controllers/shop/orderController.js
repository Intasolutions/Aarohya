// controllers/shop/orderController.js
const mongoose = require("mongoose");
const Order = require("../../models/Order");
const Address = require("../../models/address"); // use your existing Address model

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
    // Prefer stored lineTotal/unitPrice if present, else fall back
    const unit =
      it.unitPrice ??
      it.price ??
      it.priceAtAdd ??
      p.salePrice ??
      p.regularPrice ??
      0;
    const total = (it.lineTotal != null) ? Number(it.lineTotal) : (unit * qty);
    const id = p._id || it.productId || null;
    return { id, name, img, color, qty, unit: Number(unit || 0), total: Number(total || 0) };
  });

  // Prefer new schema totals; fall back to legacy mirrors/derived
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

  // Address: prefer new snapshot
  const address = o.shippingAddress || o.address || {};

  // Status & payment: prefer new schema
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

    // filter by orderStatus (not the virtual)
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
      // lean is fine; we'll normalize below
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
      orders: normOrders, // pass normalized orders
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

    const order = await Order.findOne({ _id: id, userId: req.user._id }).lean();
    if (!order) return res.status(404).render("shop/orderDetails", { notFound: true });

    const norm = normalizeOrder(order);

    res.render("shop/orderDetails", {
      user: req.user,
      order: order,
      norm,
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
        gstin: "29ABCDE1234F1Z5", // optional
      },
    });
  } catch (err) {
    next(err);
  }
};

/* ------------------------- place order ------------------------- */

// small helpers for rounding & mapping
const r2 = (n) => Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;

// Try to gather items from request or session (no UI change needed)
function pickCheckoutItems(req) {
  if (Array.isArray(req.body.items) && req.body.items.length) {
    return req.body.items;
  }
  if (req.session && Array.isArray(req.session.checkoutItems) && req.session.checkoutItems.length) {
    return req.session.checkoutItems;
  }
  // common cart session shapes
  if (req.session && req.session.cart && Array.isArray(req.session.cart.items) && req.session.cart.items.length) {
    return req.session.cart.items;
  }
  if (req.session && Array.isArray(req.session.cart) && req.session.cart.length) {
    return req.session.cart; // sometimes stored as a flat array
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
  // copy every reqd field for Order snapshot
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

exports.placeOrder = async (req, res, next) => {
  try {
    if (!req.user) return res.redirect("/auth/login");
    const userId = req.user._id;

    // 1) Items (from body or session)
    const rawItems = pickCheckoutItems(req);
    if (!rawItems || !rawItems.length) {
      throw new Error("No items to place order");
    }
    const orderedItems = mapToOrderedItems(rawItems);

    // 2) Shipping snapshot
    let shippingAddress;
    const addrId = req.body.addressId; // present when "Use saved" is selected
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

    // 3) Payment (must be in enum)
    const allowed = ["cod","wallet","razorpay","online","online payment"];
    const method = (req.body.paymentMethod || "").toLowerCase();
    if (!allowed.includes(method)) throw new Error("Invalid payment method");
    const payment = { method, paymentStatus: "pending", isPaid: false };

    // 4) Totals
    const subtotal       = r2(orderedItems.reduce((s, i) => s + i.lineTotal, 0));
    const discountAmount = r2(Number(req.body.discountAmount || 0));
    const shippingFee    = r2(Number(req.body.shippingFee || 0));
    const taxAmount      = r2(Number(req.body.taxAmount || 0));
    const grandTotal     = r2(subtotal - discountAmount + shippingFee + taxAmount);

    // 5) Save order
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
    });

    await order.save();

    // clear common session keys if present (optional, harmless if not set)
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
