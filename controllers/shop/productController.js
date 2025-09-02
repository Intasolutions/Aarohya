const Product = require("../../models/Product");

const getproductDetails = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate("category")
      .populate("subcategory");

    if (!product) {
      return res.status(404).send("Product not found");
    }
    const relatedProducts = await Product.find({
      category: product.category._id,
      _id: { $ne: product._id }, 
      isBlocked: false
    }).limit(4);

    res.render("shop/productsDetails", { product ,relatedProducts});
  } catch (error) {
    console.error(error);
    res.status(500).send("Server Error");
  }
};
module.exports = { getproductDetails };
