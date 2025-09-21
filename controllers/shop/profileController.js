const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const User = require("../../models/User");
const Address = require("../../models/Address");

// Load Profile Page (with addresses)
const loadProfile = async (req, res, next) => {
  try {
    const userId = req.user._id; // JWT user
    if (!mongoose.isValidObjectId(userId)) throw new Error("Invalid User ID");

    const user = await User.findById(userId);
    const addresses = await Address.findOne({ userId });

    res.render("shop/profile", { user, addresses });
  } catch (error) {
    console.error(error);
    res.redirect("/pageNotFound");
  }
};

// Edit Profile Info
const editProfile = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { fullName, phone } = req.body;

    if (!fullName || !phone) {
      return res.status(400).json({ success: false, message: "All fields required" });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { fullName, phone },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.json({ success: true, message: "Profile updated successfully!", user: updatedUser });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// Upload Profile Picture
const uploadProfilePicture = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { profileImage: req.file.filename },
      { new: true }
    );

    if (!updatedUser) throw new Error("User not found");
    res.redirect("shop/profile");
  } catch (error) {
    console.error(error);
    next(error);
  }
};

// Change Password
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const userId = req.user._id;

    if (!currentPassword || !newPassword || !confirmPassword) {
      req.flash("error", "All fields are required");
      return res.redirect("/changePassword");
    }

    const user = await User.findById(userId);
    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) {
      req.flash("error", "Current password is incorrect");
      return res.redirect("/changePassword");
    }

    if (newPassword !== confirmPassword) {
      req.flash("error", "Passwords do not match");
      return res.redirect("/changePassword");
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await User.updateOne({ _id: userId }, { password: hashedPassword });

    req.flash("success", "Password updated successfully!");
    res.redirect("/profile");
  } catch (error) {
    console.error(error);
    res.redirect("/pageNotFound");
  }
};

// Address Management
const addAddress = async (req, res) => {
  try {
    const userId = req.user._id;
    const addressData = req.body;

    let userAddress = await Address.findOne({ userId });

    if (!userAddress) {
      userAddress = new Address({ userId, address: [addressData] });
    } else {
      userAddress.address.push(addressData);
    }

    await userAddress.save();
    res.redirect("/profile/addresses");
  } catch (error) {
    console.error(error);
    res.redirect("/pageNotFound");
  }
};

const editAddress = async (req, res) => {
  try {
    const addressId = req.query.id;
    const updatedData = req.body;

    const addressDoc = await Address.findOne({ "address._id": addressId });
    if (!addressDoc) return res.status(404).json({ message: "Address not found" });

    await Address.updateOne(
      { "address._id": addressId },
      { $set: Object.fromEntries(Object.entries(updatedData).map(([k,v]) => [`address.$.${k}`, v])) }
    );

    res.json({ message: "Address updated successfully!" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const deleteAddress = async (req, res) => {
  try {
    const addressId = req.query.id;

    const updatedDoc = await Address.findOneAndUpdate(
      { "address._id": addressId },
      { $pull: { address: { _id: addressId } } },
      { new: true }
    );

    if (!updatedDoc) return res.status(404).json({ message: "Address not found" });
    res.json({ message: "Address deleted successfully!" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = {
  loadProfile,
  editProfile,
  uploadProfilePicture,
  changePassword,
  addAddress,
  editAddress,
  deleteAddress
};
