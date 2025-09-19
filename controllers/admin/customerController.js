const User = require("../../models/User");

// GET Customers List
const getCustomers = async (req, res) => {
  try {
    const customers = await User.find({ isAdmin: false, isDeleted: false }).sort({ createdAt: -1 });
    res.render("admin/customers/customers", { customers });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
};

// Toggle Block / Unblock
const toggleBlock = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).send("User not found");

    user.isBlocked = !user.isBlocked;
    await user.save();
    res.redirect("/admin/customers");
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
};

// Soft Delete User
const deleteCustomer = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).send("User not found");

    user.isDeleted = true;
    await user.save();
    res.redirect("/admin/customers");
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
};

module.exports = {
  getCustomers,
  toggleBlock,
  deleteCustomer,
};
