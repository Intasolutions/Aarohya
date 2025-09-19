const User = require("../../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// GET Signup Page
const getSignupPage = (req, res) => {
  res.render("auth/signup", { error: null });
};

// POST Signup
const postSignup = async (req, res) => {
  try {
    const { name, email, phone, password, confirmPassword } = req.body;

    if (password !== confirmPassword) {
      return res.status(400).render("auth/signup", { error: "Passwords do not match!" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).render("auth/signup", { error: "Email already registered!" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({ name, email, phone, password: hashedPassword });
    await user.save();

    const token = jwt.sign({ id: user._id, isAdmin: user.isAdmin }, process.env.JWT_SECRET, { expiresIn: "1d" });

    res.cookie("token", token, {
      httpOnly: true,
      secure: false,
      maxAge: 24 * 60 * 60 * 1000, // 1 day
    });

    res.redirect("/");
  } catch (err) {
    console.error(err);
    res.status(500).render("auth/signup", { error: "Something went wrong!" });
  }
};

// GET Login Page
const getLoginPage = (req, res) => {
  res.render("auth/login", { error: null });
};

// POST Login
const postLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.render("auth/login", { error: "Invalid email or password" });
    }

    if (user.isBlocked) {
      return res.render("auth/login", { error: "Account is blocked" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.render("auth/login", { error: "Invalid email or password" });
    }

    const token = jwt.sign({ id: user._id, isAdmin: user.isAdmin }, process.env.JWT_SECRET, { expiresIn: "1d" });

    res.cookie("token", token, {
      httpOnly: true,
      secure: false,
      maxAge: 24 * 60 * 60 * 1000,
    });

    return res.redirect("/");
  } catch (error) {
    console.error(error);
    return res.render("auth/login", { error: "Something went wrong" });
  }
};

// Logout
const logout = (req, res) => {
  res.clearCookie("token");
  res.redirect("/auth/login");
};

module.exports = {
  getSignupPage,
  getLoginPage,
  postSignup,
  postLogin,
  logout,
};
