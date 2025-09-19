const Cart = require("../../models/Cart");
const Product = require("../../models/Product");

// GET Cart Page
const getCart = async (req, res) => {
  try {
    if (!req.user) return res.redirect("/auth/login");

    const userId = req.user._id;

    // Find the user's cart, create if it doesn't exist
    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = new Cart({ userId, items: [], discount: 0 });
      await cart.save();
    }

    // Ensure cart object is never undefined
    cart = cart || { items: [], discount: 0 };

    // Total price calculation
    const total = cart.items.reduce(
      (sum, item) => sum + (item.totalPrice || 0),
      0
    ) - (cart.discount || 0);

    res.render("shop/cart", { cart, total });
  } catch (error) {
    console.error("Cart Controller Error:", error);
    res.status(500).send("Server Error");
  }
};



// ADD TO CART
const addToCart = async (req, res) => {
  try {
    const userId = req.user._id;
    const productId = req.params.id;
    let { quantity = 1, selectedColor } = req.body;

    // Ensure quantity is at least 1
    quantity = Math.max(1, parseInt(quantity));

    // Fetch product
    const product = await Product.findById(productId);
    if (!product || product.isBlocked || product.quantity <= 0) {
      return res.status(404).json({ message: "Product not available" });
    }

    // Validate selectedColor if product has colors
    if (product.availableColors && product.availableColors.length > 0) {
      if (!selectedColor || !product.availableColors.includes(selectedColor)) {
        return res.status(400).json({ message: "Invalid color selection" });
      }
    } else {
      selectedColor = null; // no color options
    }

    // Fetch or create cart
    let cart = await Cart.findOne({ userId });
    if (!cart) cart = new Cart({ userId, items: [] });

    // Check if the item already exists in cart
    const existingItemIndex = cart.items.findIndex(
      (item) =>
        item.productId.toString() === productId &&
        item.selectedColor === selectedColor
    );

    if (existingItemIndex > -1) {
      // Increment quantity but do not exceed product stock
      cart.items[existingItemIndex].quantity += quantity;
      if (cart.items[existingItemIndex].quantity > product.quantity) {
        cart.items[existingItemIndex].quantity = product.quantity;
      }

      cart.items[existingItemIndex].totalPrice =
        cart.items[existingItemIndex].quantity * product.salePrice;
    } else {
      // Add new item to cart
      cart.items.push({
        productId: product._id,
        quantity,
        selectedColor,
        productName: product.productName,
        productImage: product.productImage[0],
        priceAtAdd: product.salePrice,
        totalPrice: product.salePrice * quantity,
      });
    }

    await cart.save();

    // Calculate total
    const total = cart.items.reduce((sum, item) => sum + item.totalPrice, 0);

    return res.status(200).json({
      message: "Item added to cart",
      cart,
      total,
    });
  } catch (error) {
    console.error("Add to Cart Error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

const updateQuantity = async (req, res) => {
  try {
    const userId = req.user._id;
    let { itemId, quantity } = req.body;

    // convert to integer and validate
    quantity = parseInt(quantity, 10);
    if (isNaN(quantity) || quantity < 1) quantity = 1;

    const cart = await Cart.findOne({ userId });
    if (!cart) return res.status(404).send("Cart not found");

    const item = cart.items.id(itemId);
    if (!item) return res.status(404).send("Item not found");

    // ✅ Fetch product to check stock
    const product = await Product.findById(item.productId);
    if (!product) return res.status(404).send("Product not found");

    // ✅ Cap quantity between 1 and product stock
    if (quantity > product.quantity) {
      quantity = product.quantity;
    }
    if (quantity < 1) {
      quantity = 1; // 🔑 ensures schema rule not violated
    }

    // update
    item.quantity = quantity;
    item.totalPrice = item.quantity * item.priceAtAdd;

    await cart.save();
    res.redirect("/cart");
  } catch (error) {
    console.error("Update Quantity Error:", error);
    res.status(500).send("Server Error");
  }
};



// REMOVE ITEM
const removeItem = async (req, res) => {
  try {
    const userId = req.user._id;
    const { itemId } = req.body;

    const cart = await Cart.findOne({ userId });
    if (!cart) return res.status(404).send("Cart not found");

    cart.items = cart.items.filter((i) => i._id.toString() !== itemId);
    await cart.save();
    res.redirect("/cart");
  } catch (error) {
    console.error(error);
    res.status(500).send("Server Error");
  }
};

// CLEAR CART
const clearCart = async (req, res) => {
  try {
    const userId = req.user._id;
    const cart = await Cart.findOne({ userId });
    if (!cart) return res.redirect("/cart");

    cart.items = [];
    cart.discount = 0;
    await cart.save();
    res.redirect("/cart");
  } catch (error) {
    console.error(error);
    res.status(500).send("Server Error");
  }
};

module.exports = {
  getCart,
  addToCart,
  updateQuantity,
  removeItem,
  clearCart,
};
