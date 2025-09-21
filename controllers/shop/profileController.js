const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const User = require("../../models/User");
const Address = require("../../models/Address");

// Load Profile Page (with addresses)
const loadProfile = async (req, res, next) => {
  try {
    const userId = req.user._id;
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
// NOTE: your schema uses "name" (not fullName). We'll map fullName -> name.
const editProfile = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { fullName, phone, email } = req.body;

    if (!fullName || !phone) {
      return res
        .status(400)
        .json({ success: false, message: "All fields required" });
    }

    const update = {
      name: fullName,
      phone,
    };
    if (email) update.email = email;

    const updatedUser = await User.findByIdAndUpdate(userId, update, {
      new: true,
    });

    if (!updatedUser) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    res.json({
      success: true,
      message: "Profile updated successfully!",
      user: updatedUser,
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

// Upload Profile Picture
const uploadProfilePicture = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { profileImage: req.file.filename }, // we store just the file name
      { new: true }
    );

    if (!updatedUser) throw new Error("User not found");

    // if XHR, return JSON; else redirect back to profile
    const wantsJSON =
      req.xhr ||
      (req.headers.accept && req.headers.accept.includes("application/json"));
    if (wantsJSON) {
      return res.json({ success: true, user: updatedUser });
    }
    res.redirect("/profile");
  } catch (error) {
    console.error(error);
    next(error);
  }
};

// Change Password
// Change Password
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const userId = req.user._id;

    // Basic required checks
    if (!currentPassword || !newPassword || !confirmPassword) {
      req.flash?.("error", "All fields are required");
      return res.redirect("/profile#security");
    }

    // Load user with password
    const user = await User.findById(userId);
    if (!user) {
      req.flash?.("error", "User not found");
      return res.redirect("/profile#security");
    }
    if (!user.password) {
      // e.g., social login accounts with no local password yet
      req.flash?.("error", "No password set for this account. Use “Forgot password” to set one.");
      return res.redirect("/profile#security");
    }

    const ok = await bcrypt.compare(currentPassword, user.password);
    if (!ok) {
      req.flash?.("error", "Current password is incorrect");
      return res.redirect("/profile#security");
    }

    if (newPassword !== confirmPassword) {
      req.flash?.("error", "Passwords do not match");
      return res.redirect("/profile#security");
    }

    if (newPassword.length < 8) {
      req.flash?.("error", "New password must be at least 8 characters");
      return res.redirect("/profile#security");
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    user.password = hashed;
    await user.save();

    req.flash?.("success", "Password updated successfully!");
    return res.redirect("/profile#security");
  } catch (error) {
    console.error(error);
    return res.redirect("/pageNotFound");
  }
};

// Address Management
const addAddress = async (req, res) => {
  try {
    const userId = req.user._id;
    const addressData = req.body;

    let doc = await Address.findOne({ userId });

    if (!doc) {
      doc = new Address({ userId, address: [addressData] });
    } else {
      doc.address.push(addressData);
    }

    await doc.save();

    // The newly-inserted subdoc (last item)
    const newAddr = doc.address[doc.address.length - 1];

    const wantsJSON =
      req.xhr ||
      (req.headers.accept && req.headers.accept.includes("application/json"));

    if (wantsJSON) {
      return res.json({ success: true, address: newAddr });
    }

    // old behavior fallback
    res.redirect("/profile#addresses");
  } catch (error) {
    console.error(error);
    const wantsJSON =
      req.xhr ||
      (req.headers.accept && req.headers.accept.includes("application/json"));
    if (wantsJSON) {
      return res
        .status(500)
        .json({ success: false, message: "Failed to add address" });
    }
    res.redirect("/pageNotFound");
  }
};

const editAddress = async (req, res) => {
  try {
    const addressId = req.query.id;
    const updatedData = req.body;

    const addressDoc = await Address.findOne({ "address._id": addressId });
    if (!addressDoc)
      return res.status(404).json({ message: "Address not found" });

    await Address.updateOne(
      { "address._id": addressId },
      {
        $set: Object.fromEntries(
          Object.entries(updatedData).map(([k, v]) => [`address.$.${k}`, v])
        ),
      }
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

    if (!updatedDoc)
      return res.status(404).json({ message: "Address not found" });
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
  deleteAddress,
};
