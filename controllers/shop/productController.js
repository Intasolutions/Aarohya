// controllers/shop/productController.js
const jwt = require("jsonwebtoken");
const Product = require("../../models/Product");
const User = require("../../models/User"); // or process.env.JWT_SECRET

function getUserIdFromCookie(req) {
  try {
    const t = req.cookies?.token;
    if (!t) return null;
    const decoded = jwt.verify(t, JWT_SECRET);
    return decoded.id;
  } catch {
    return null;
  }
}

exports.getproductDetails = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate("category")
      .populate("subcategory");

    if (!product) return res.status(404).send("Product not found");

    const relatedProducts = await Product.find({
      category: product.category?._id,
      _id: { $ne: product._id },
      isBlocked: false,
    })
      .limit(4)
      .lean();

    let variants = [];
    if (product.productNumber?.trim()) {
      const all = await Product.find({
        productNumber: product.productNumber,
        isBlocked: false,
      }).lean();
      // de-dup by color
      const seen = new Set();
      variants = all.filter((v) => {
        const key = (v.color || "").toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    let isWished = false;
    const uid = getUserIdFromCookie(req);
    if (uid) {
      isWished = !!(await User.exists({ _id: uid, wishlist: product._id }));
    }

    res.render("shop/productsDetails", {
      product,
      relatedProducts,
      variants,
      isWished,
      active: "Details",
      pageTitle: product.productName,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Server Error");
  }
};
