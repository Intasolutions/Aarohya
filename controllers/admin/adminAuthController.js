const User = require("../../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// GET Admin Login Page
const getLoginPage = (req, res) => {
  res.render("admin/login", { error: null });
};

// POST Admin Login
const postLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const admin = await User.findOne({ email, isAdmin: true });
    if (!admin) {
      return res.render("admin/login", { error: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.render("admin/login", { error: "Invalid email or password" });
    }

    const token = jwt.sign({ id: admin._id, isAdmin: admin.isAdmin }, process.env.JWT_SECRET, { expiresIn: "1d" });

    res.cookie("adminToken", token, {
      httpOnly: true,
      secure: false, // true if using HTTPS
      maxAge: 24 * 60 * 60 * 1000
    });

    res.redirect("/admin");
  } catch (err) {
    console.error(err);
    res.render("admin/login", { error: "Something went wrong" });
  }
};

// Admin Logout
const logout = (req, res) => {
  res.clearCookie("adminToken");
  res.redirect("/admin/login");
};

module.exports = {
  getLoginPage,
  postLogin,
  logout
};
