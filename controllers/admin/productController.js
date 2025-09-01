const Product = require("../../models/Product");
const Category = require("../../models/Category");
const SubCategory = require("../../models/SubCategory");
const Collection = require("../../models/Collection");
const Brand = require("../../models/Brand");

exports.listProducts = async (req, res) => {
  const products = await Product.find()
    .populate("category subcategory collections brandId");
  res.render("admin/products/list", { products });
};

exports.getAddProduct = async (req, res) => {
  const categories = await Category.find();
  const subcategories = await SubCategory.find();
  const collections = await Collection.find();
  const brands = await Brand.find();
  res.render("admin/products/add", { categories, subcategories, collections, brands });
};

exports.postAddProduct = async (req, res) => {
  try {
    const images = req.files.map(file => "/uploads/" + file.filename);
    await Product.create({
      ...req.body,
      productImage: images,
    });
    res.redirect("/admin/products");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error saving product");
  }
};

exports.getEditProduct = async (req, res) => {
  const product = await Product.findById(req.params.id);
  const categories = await Category.find();
  const subcategories = await SubCategory.find();
  const collections = await Collection.find();
  const brands = await Brand.find();
  res.render("admin/products/edit", { product, categories, subcategories, collections, brands });
};

exports.postEditProduct = async (req, res) => {
  try {
    const images = req.files.map(file => "/uploads/" + file.filename);
    await Product.findByIdAndUpdate(req.params.id, {
      ...req.body,
      ...(images.length > 0 && { productImage: images }),
    });
    res.redirect("/admin/products");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error updating product");
  }
};

exports.deleteProduct = async (req, res) => {
  await Product.findByIdAndUpdate(req.params.id, { isBlocked: true });
  res.redirect("/admin/products");
};
