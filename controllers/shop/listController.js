const Product = require("../../models/Product");
const Category = require("../../models/Category");
const SubCategory = require("../../models/SubCategory");

exports.getShopProducts = async (req, res) => {
  try {
    const { category, subcategory, color, minPrice, maxPrice, inStock, sort } = req.query;

    // Build query dynamically
    let query = { isBlocked: false };

    if (category) query.category = category;
    if (subcategory) query.subcategory = subcategory;
    if (color) query.color = color;
    if (minPrice && maxPrice) {
      query.salePrice = { $gte: Number(minPrice), $lte: Number(maxPrice) };
    }
    if (inStock === "true") query.quantity = { $gt: 0 };

    // Sorting
    let sortOption = {};
    switch (sort) {
      case "priceAsc":
        sortOption.salePrice = 1;
        break;
      case "priceDesc":
        sortOption.salePrice = -1;
        break;
      case "newest":
        sortOption.createdAt = -1;
        break;
      case "oldest":
        sortOption.createdAt = 1;
        break;
      case "discount":
        sortOption.discount = -1; // optional: can calculate using aggregation
        break;
      default:
        sortOption.createdAt = -1;
    }

    // Fetch products
    const products = await Product.find(query)
      .populate("category subcategory")
      .sort(sortOption);

    // Fetch categories and subcategories for filters
    const categories = await Category.find();
    const subcategories = await SubCategory.find();

    res.render("shop/list", { products, categories, subcategories, filters: req.query });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
};
