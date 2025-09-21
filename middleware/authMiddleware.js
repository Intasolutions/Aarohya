const jwt = require("jsonwebtoken");
const User = require("../models/User");

const JWT_SECRET = process.env.JWT_SECRET || "your_secret_key";


exports.protect = async (req, res, next) => {
  try {
    const token = req.cookies?.token;
    const wantsJson =
      req.xhr ||
      req.headers["x-requested-with"] === "XMLHttpRequest" ||
      req.headers["x-requested-with"] === "fetch" ||
      (req.headers.accept || "").includes("application/json");

    if (!token) {
      if (wantsJson) return res.status(401).json({ success: false, message: "Auth required" });
      return res.redirect("/auth/login");
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      res.clearCookie("token");
      if (wantsJson) return res.status(401).json({ success: false, message: "Auth required" });
      return res.redirect("/auth/login");
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("Auth Middleware Error:", error);
    res.clearCookie("token");
    const wantsJson =
      req.xhr ||
      req.headers["x-requested-with"] === "XMLHttpRequest" ||
      req.headers["x-requested-with"] === "fetch" ||
      (req.headers.accept || "").includes("application/json");
    if (wantsJson) return res.status(401).json({ success: false, message: "Auth required" });
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
