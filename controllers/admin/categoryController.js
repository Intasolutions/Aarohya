const Category = require("../../models/Category");

// List categories
exports.listCategories = async (req, res) => {
  const categories = await Category.find();
  res.render("admin/categories/list", { categories });
};

// Add category form
exports.getAddCategory = (req, res) => {
  res.render("admin/categories/add");
};

// Save new category
exports.postAddCategory = async (req, res) => {
  try {
    let { name, slug, isPrivate } = req.body;
    // If slug is not given, auto-generate from name
    if (!slug) slug = name.toLowerCase().replace(/\s+/g, "-");

    await Category.create({
      name,
      slug,
      isPrivate: isPrivate === "on", // checkbox
    });

    res.redirect("/admin/categories");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error adding category");
  }
};

// Edit category form
exports.getEditCategory = async (req, res) => {
  const category = await Category.findById(req.params.id);
  res.render("admin/categories/edit", { category });
};

// Update category
exports.postEditCategory = async (req, res) => {
  try {
    let { name, slug, isPrivate } = req.body;
    if (!slug) slug = name.toLowerCase().replace(/\s+/g, "-");

    await Category.findByIdAndUpdate(req.params.id, {
      name,
      slug,
      isPrivate: isPrivate === "on",
    });

    res.redirect("/admin/categories");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error updating category");
  }
};

// Delete category
exports.deleteCategory = async (req, res) => {
  try {
    await Category.findByIdAndDelete(req.params.id);
    res.redirect("/admin/categories");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error deleting category");
  }
};
