const Product = require("../../models/Product");

// GET /admin/inventory
exports.getInventory = async (req, res, next) => {
  try {
    const { search = "", page = 1, limit = 10, sortField = "productName", sortOrder = "asc" } = req.query;

    const filter = search
      ? { productName: { $regex: search, $options: "i" } }
      : {};

    const total = await Product.countDocuments(filter);

    const products = await Product.find(filter)
      .sort({ [sortField]: sortOrder === "asc" ? 1 : -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean();

    res.render("admin/inventory/inventory", {
      products,
      currentPage: Number(page),
      totalPages: Math.ceil(total / limit),
      search,
      sortField,
      sortOrder,
    });
  } catch (err) {
    next(err);
  }
};

// POST /admin/inventory/update-stock
exports.updateStock = async (req, res, next) => {
  try {
    const { productId, quantity } = req.body;

    if (!productId || quantity == null) {
      return res.status(400).json({ success: false, message: "Invalid data." });
    }

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ success: false, message: "Product not found." });

    product.quantity = Number(quantity);
    await product.save();

    res.json({ success: true, quantity: product.quantity });
  } catch (err) {
    next(err);
  }
};
