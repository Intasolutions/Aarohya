const jwt = require("jsonwebtoken");
const User = require("../models/User");

const protectAdmin = async (req, res, next) => {
  try {
    const token = req.cookies.adminToken;
    if (!token) {
      return res.redirect("/admin/login");
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const admin = await User.findById(decoded.id);

    if (!admin || !admin.isAdmin) {
      return res.redirect("/admin/login");
    }

    req.admin = admin; // attach admin data to request
    next();
  } catch (err) {
    console.error(err);
    return res.redirect("/admin/login");
  }
};

module.exports = { protectAdmin };
