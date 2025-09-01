const SubCategory = require("../../models/SubCategory");
const Category = require("../../models/Category");

// List all subcategories
exports.listSubCategories = async (req, res) => {
  const subcategories = await SubCategory.find().populate("category");
  res.render("admin/subcategories/list", { subcategories });
};

// Add form
exports.getAddSubCategory = async (req, res) => {
  const categories = await Category.find();
  res.render("admin/subcategories/add", { categories });
};

// Save new subcategory
exports.postAddSubCategory = async (req, res) => {
  try {
    let { name, slug, category } = req.body;
    if (!slug) slug = name.toLowerCase().replace(/\s+/g, "-");

    await SubCategory.create({ name, slug, category });
    res.redirect("/admin/subcategories");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error adding subcategory");
  }
};

// Edit form
exports.getEditSubCategory = async (req, res) => {
  const subcategory = await SubCategory.findById(req.params.id);
  const categories = await Category.find();
  res.render("admin/subcategories/edit", { subcategory, categories });
};

// Update
exports.postEditSubCategory = async (req, res) => {
  try {
    let { name, slug, category } = req.body;
    if (!slug) slug = name.toLowerCase().replace(/\s+/g, "-");

    await SubCategory.findByIdAndUpdate(req.params.id, { name, slug, category });
    res.redirect("/admin/subcategories");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error updating subcategory");
  }
};

// Delete
exports.deleteSubCategory = async (req, res) => {
  try {
    await SubCategory.findByIdAndDelete(req.params.id);
    res.redirect("/admin/subcategories");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error deleting subcategory");
  }
};
