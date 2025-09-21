const Cart = require("../../models/Cart");
const Product = require("../../models/Product");
const Category = require("../../models/Category");

// ==================== LOAD CART ====================
const getCart = async (req, res, next) => {
  try {
    if (!req.user) return res.redirect("/auth/login");

    const userId = req.user._id;

    // Populate only the product details, no categoryId
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

    // Reset discount if any
    if (cart.discount && cart.discount > 0) {
      await Cart.findOneAndUpdate({ userId }, { $set: { discount: 0 } });
    }

const cartData = cart.items
  .filter((item) => item.productId && item.productId.isBlocked === false)
  .map((item) => ({
    itemId: item._id, // 🔑 subdocument id
    productDetails: item.productId,
    quantity: item.quantity,
    selectedColor: item.selectedColor, // keep color info
  }));


    const grandTotal = cart.items
      .filter((item) => item.productId && item.productId.isBlocked === false)
      .reduce(
        (acc, item) => acc + (item.productId?.salePrice || 0) * item.quantity,
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

    // Fetch product
    const product = await Product.findOne({ _id: productId, isBlocked: false });
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not available" });
    }

    // Find or create cart
    let cart = await Cart.findOne({ userId });
    if (!cart) cart = new Cart({ userId, items: [] });

    // Default selectedColor if not provided
    const colorValue = selectedColor || "none"; // must match enum or optional

    // Check if product + color already in cart
    const existingIndex = cart.items.findIndex(
      (item) =>
        item.productId.toString() === productId &&
        item.selectedColor === colorValue
    );

    if (existingIndex > -1) {
      // Increase quantity if exists
      let newQty = cart.items[existingIndex].quantity + quantity;

      // Limit stock & max cart quantity
      newQty = Math.min(newQty, product.quantity, 5);

      cart.items[existingIndex].quantity = newQty;
      cart.items[existingIndex].totalPrice =
        newQty * cart.items[existingIndex].priceAtAdd;
    } else {
      // New item
      cart.items.push({
        productId,
        quantity,
        selectedColor: colorValue,
        productName: product.productName,
        productImage: product.productImage[0],
        priceAtAdd: product.salePrice,
        totalPrice: quantity * product.salePrice,
      });
    }

    await cart.save();

    const total = cart.items.reduce((sum, item) => sum + item.totalPrice, 0);

    res.status(200).json({
      success: true,
      message: "Product added to cart",
      cart,
      total,
    });
  } catch (error) {
    next(error);
  }
};

// ==================== UPDATE QUANTITY ====================
const updateQuantity = async (req, res, next) => {
  try {
    const userId = req.user._id;
    let { itemId, productId, selectedColor, quantity } = req.body;  
    if (isNaN(quantity) || quantity < 1) quantity = 1;

    // Find user's cart
    const cart = await Cart.findOne({ userId });
    if (!cart)
      return res.status(404).json({ success: false, message: "Cart not found" });

    let item;

    // 1️⃣ Try finding by cart subdocument _id
    if (itemId) {
      item = cart.items.id(itemId);
    }

    // 2️⃣ Fallback: match by productId + selectedColor
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
      return res.status(404).json({ success: false, message: "Product not available" });

    // ✅ Assign color directly from product if needed
    item.selectedColor = product.color || item.selectedColor || "none";

    // Limit quantity based on stock & max per cart
    if (quantity > product.quantity) quantity = product.quantity;
    if (quantity > 5) quantity = 5;

    // Update cart item
    item.quantity = quantity;
    item.totalPrice = item.quantity * item.priceAtAdd;

    await cart.save();

    const grandTotal = cart.items.reduce((sum, i) => sum + i.totalPrice, 0);

    res.status(200).json({
      success: true,
      message: "Cart updated successfully",
      cart,
      grandTotal,
    });
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

    const total = cart.items.reduce((sum, i) => sum + i.totalPrice, 0);

    res.status(200).json({
      success: true,
      message: "Product removed from cart",
      cart,
      total,
    });
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

// ==================== VALIDATE CHECKOUT ====================
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
