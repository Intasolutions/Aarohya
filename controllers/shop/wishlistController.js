// controllers/user/wishlistController.js
const Product = require("../../models/Product");
const User = require("../../models/User");
const Cart = require("../../models/Cart");

const loadWishlist = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);

    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const skip = (page - 1) * limit;

    const cart = await Cart.findOne({ user: userId });
    const cartProductIds = cart ? cart.items.map((item) => item.productId.toString()) : [];

    const products = await Product.find({
      _id: { $in: user.wishlist, $nin: cartProductIds },
      isBlocked: false,
    })
      .populate("category subcategory")
      .skip(skip)
      .limit(limit);

    const totalProducts = await Product.countDocuments({
      _id: { $in: user.wishlist, $nin: cartProductIds },
      isBlocked: false,
    });

    const totalPages = Math.ceil(totalProducts / limit);

    res.render("shop/wishlist", {
      wishlist: products,
      currentPage: page,
      totalPages,
      active: "wishlist",
    });
  } catch (err) {
    next(err);
  }
};

const addToWishlist = async (req, res, next) => {
  try {
    const productId = req.params.id;
    const userId = req.user._id;
    const user = await User.findById(userId).select("wishlist");

    if (user.wishlist.map(String).includes(String(productId))) {
      return res.status(200).json({ success: true, message: "Already in wishlist" });
    }
    user.wishlist.push(productId);
    await user.save();

    res.status(200).json({ success: true, message: "Product added to wishlist" });
  } catch (err) {
    next(err);
  }
};

const removeFromWishlist = async (req, res, next) => {
  try {
    const productId = req.params.id;
    const userId = req.user._id;
    const user = await User.findById(userId).select("wishlist");

    user.wishlist = user.wishlist.filter((p) => String(p) !== String(productId));
    await user.save();

    res.status(200).json({ success: true, message: "Product removed from wishlist" });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  loadWishlist,
  addToWishlist,
  removeFromWishlist,
};
