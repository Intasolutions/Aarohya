const jwt = require("jsonwebtoken");
const User = require("../models/User");

const JWT_SECRET = process.env.JWT_SECRET || "your_secret_key";

// Protect user routes (requires login)
exports.protect = async (req, res, next) => {
  try {
    const token = req.cookies.token;
    if (!token) {
      return res.redirect("/auth/login"); // fix redirect path
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);

    // Attach user to request
    req.user = await User.findById(decoded.id).select("-password");

    if (!req.user) {
      res.clearCookie("token");
      return res.redirect("/auth/login");
    }

    next();
  } catch (error) {
    console.error("Auth Middleware Error:", error);
    res.clearCookie("token");
    res.redirect("/auth/login");
  }
};

// Admin only (requires isAdmin true)
exports.adminOnly = (req, res, next) => {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).render("errors/403", { message: "Access denied" });
  }
  next();
};
