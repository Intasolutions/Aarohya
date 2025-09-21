const Cart = require("../../models/Cart");
const Product = require("../../models/Product");

// ==================== LOAD CART ====================
const getCart = async (req, res, next) => {
  try {
    if (!req.user) return res.redirect("/auth/login");

    const userId = req.user._id;

    let cart = await Cart.findOne({ userId }).populate({
      path: "items.productId",
      model: "Product",
    });

    if (!cart || cart.items.length === 0) {
      return res.render("shop/cart", {
        data: [],
        grandTotal: 0,
        user: req.user,
      });
    }

    // If you reset discounts elsewhere, keep this if needed
    if (cart.discount && cart.discount > 0) {
      await Cart.findOneAndUpdate({ userId }, { $set: { discount: 0 } });
    }

    // Build data for the view
    const validItems = cart.items.filter(
      (item) => item.productId && item.productId.isBlocked === false
    );

    const cartData = validItems.map((item) => ({
      itemId: item._id,
      productDetails: item.productId,
      quantity: item.quantity,
      selectedColor: item.selectedColor,
    }));

    const grandTotal = validItems.reduce(
      (acc, item) =>
        acc + (item.priceAtAdd != null ? item.priceAtAdd : (item.productId?.salePrice || 0)) * item.quantity,
      0
    );

    res.render("shop/cart", { data: cartData, grandTotal, user: req.user });
  } catch (error) {
    next(error);
  }
};

// ==================== ADD TO CART ====================
const addToCart = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const productId = req.params.id;
    let { quantity = 1, selectedColor } = req.body;

    quantity = Math.max(1, parseInt(quantity));

    const product = await Product.findOne({ _id: productId, isBlocked: false });
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not available" });
    }

    let cart = await Cart.findOne({ userId });
    if (!cart) cart = new Cart({ userId, items: [] });

    // Normalize color
    const allowedColors = ["Silver", "Gold", "Rose Gold"];
    const incoming = (typeof selectedColor === "string" ? selectedColor.trim() : "");
    const colorValue = allowedColors.includes(incoming)
      ? incoming
      : (product.color || "none"); // prefer product color

    // See if same product + color already exists
    const existingIndex = cart.items.findIndex(
      (item) =>
        item.productId.toString() === productId &&
        (item.selectedColor || "none") === (colorValue || "none")
    );

    if (existingIndex > -1) {
      // bump quantity, cap by stock and max-per-line (5)
      let newQty = cart.items[existingIndex].quantity + quantity;
      newQty = Math.min(newQty, product.quantity, 5);
      cart.items[existingIndex].quantity = newQty;
      const price = cart.items[existingIndex].priceAtAdd ?? product.salePrice ?? product.regularPrice;
      cart.items[existingIndex].priceAtAdd = price;
      cart.items[existingIndex].totalPrice = newQty * price;
    } else {
      const price = product.salePrice ?? product.regularPrice;
      cart.items.push({
        productId,
        quantity,
        selectedColor: colorValue,
        productName: product.productName,
        productImage: product.productImage?.[0] || null,
        priceAtAdd: price,
        totalPrice: quantity * price,
      });
    }

    await cart.save();

    const total = cart.items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);

    // Support both XHR and normal form posts
    if (req.xhr || req.headers["x-requested-with"] === "XMLHttpRequest") {
      return res.status(200).json({
        success: true,
        message: "Product added to cart",
        cart,
        total,
      });
    }
    return res.redirect("/cart");
  } catch (error) {
    next(error);
  }
};

// ==================== UPDATE QUANTITY ====================
const updateQuantity = async (req, res, next) => {
  try {
    const userId = req.user._id;
    let { itemId, productId, selectedColor, quantity } = req.body;
    quantity = parseInt(quantity);
    if (isNaN(quantity) || quantity < 1) quantity = 1;

    const cart = await Cart.findOne({ userId });
    if (!cart)
      return res.status(404).json({ success: false, message: "Cart not found" });

    let item;
    if (itemId) {
      item = cart.items.id(itemId);
    }
    if (!item && productId) {
      item = cart.items.find(
        (i) =>
          i.productId.toString() === productId &&
          (!selectedColor || i.selectedColor === selectedColor)
      );
    }
    if (!item) {
      return res
        .status(404)
        .json({ success: false, message: "Product not in cart" });
    }

    const product = await Product.findById(item.productId);
    if (!product)
      return res
        .status(404)
        .json({ success: false, message: "Product not available" });

    // Only fill missing color; don't override a user’s chosen color
    if (!item.selectedColor || item.selectedColor === "none") {
      item.selectedColor = product.color || "none";
    }

    if (quantity > product.quantity) quantity = product.quantity;
    if (quantity > 5) quantity = 5;

    item.quantity = quantity;
    const price = item.priceAtAdd ?? product.salePrice ?? product.regularPrice;
    item.priceAtAdd = price;
    item.totalPrice = item.quantity * price;

    await cart.save();

    const grandTotal = cart.items.reduce((sum, i) => sum + (i.totalPrice || 0), 0);

    // Support both XHR and standard form
    if (req.xhr || req.headers["x-requested-with"] === "XMLHttpRequest") {
      return res.status(200).json({
        success: true,
        message: "Cart updated successfully",
        cart,
        grandTotal,
      });
    }
    return res.redirect("/cart");
  } catch (error) {
    next(error);
  }
};

// ==================== REMOVE ITEM ====================
const removeItem = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { itemId } = req.body;

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res
        .status(404)
        .json({ success: false, message: "Cart not found" });
    }

    cart.items = cart.items.filter((i) => i._id.toString() !== itemId);
    await cart.save();

    const total = cart.items.reduce((sum, i) => sum + (i.totalPrice || 0), 0);

    if (req.xhr || req.headers["x-requested-with"] === "XMLHttpRequest") {
      return res.status(200).json({
        success: true,
        message: "Product removed from cart",
        cart,
        total,
      });
    }
    return res.redirect("/cart");
  } catch (error) {
    next(error);
  }
};

// ==================== CLEAR CART ====================
const clearCart = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const cart = await Cart.findOne({ userId });
    if (!cart) return res.redirect("/cart");

    cart.items = [];
    cart.discount = 0;
    await cart.save();

    res.redirect("/cart");
  } catch (error) {
    next(error);
  }
};


const validateCheckout = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const cart = await Cart.findOne({ userId }).populate("items.productId");

    if (!cart || !cart.items.length) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: false,
        message: Messages.CART_NOT_FOUND,
      });
    }

    for (let item of cart.items) {
      const product = item.productId;
      if (!product || product.isBlocked || product.quantity < item.quantity) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          status: false,
          message: Messages.INSUFFICIENT_STOCK(
            product?.productName || "Unknown",
            product?.quantity || 0
          ),
        });
      }
    }

    return res.status(StatusCodes.SUCCESS).json({ status: true });
  } catch (error) {
    next(error);
  }
};




module.exports = {
  getCart,
  addToCart,
  updateQuantity,
  removeItem,
  clearCart,
  validateCheckout,
};
