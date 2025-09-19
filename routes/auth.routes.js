const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth/authController");

// Signup
router.get("/signup", authController.getSignupPage);
router.post("/signup", authController.postSignup);

// Login
router.get("/login", authController.getLoginPage);
router.post("/login", authController.postLogin);

// Logout
router.get("/logout", authController.logout);

module.exports = router;