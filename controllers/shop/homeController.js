const Product = require("../../models/Product");
const Category = require("../../models/Category"); // ✅ import category model

const getHome = async (req, res) => {
  try {
    // Fetch products and categories
    const products = await Product.find({ isBlocked: false });
    const categories = await Category.find({ isBlocked: false });

    console.log(products)
    // Pass both to EJS
    res.render("shop/home", { products, categories });
  } catch (error) {
    console.error("Error loading home page:", error);
    res.status(500).send("Server error");
  }
};

module.exports = { getHome };
