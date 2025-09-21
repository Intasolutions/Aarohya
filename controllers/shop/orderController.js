// controllers/shop/orderController.js
const Order = require("../../models/Order");

/**
 * GET /orders
 * Order history for the logged-in user with filters, search and pagination.
 */
exports.listOrders = async (req, res, next) => {
  try {
    if (!req.user) return res.redirect("/auth/login");

    const userId = req.user._id;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(24, Math.max(1, parseInt(req.query.limit) || 10));
    const status = (req.query.status || "").trim();
    const q = (req.query.q || "").trim();

    const filter = { userId };

    if (status) {
      // Match status case-insensitively (handles "delivered" vs "Delivered")
      filter.status = new RegExp(`^${status}$`, "i");
    }

    if (q) {
      // Escape regex metacharacters
      const esc = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(esc, "i");

      // Support both shapes: items[] or orderedItems[]
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

    const totalPages = Math.max(1, Math.ceil(total / limit));

    res.render("shop/orders", {
      user: req.user,
      orders,
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
