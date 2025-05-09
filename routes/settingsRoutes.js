const express = require("express");
const User = require("../models/User");
const authMiddleware = require("../middleware/authMiddleware");
const bcrypt = require("bcryptjs");

const router = express.Router();

// Account Settings: Fetch user details
router.get("/account", authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select("name email phone");
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: "Error fetching account details", error: error.message });
    }
});

// Account Settings: Update user details
router.put("/account", authMiddleware, async (req, res) => {
    try {
        const { name, email, phone } = req.body;
        const user = await User.findByIdAndUpdate(req.user.id, { name, email, phone }, { new: true });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        res.json({ message: "Account details updated successfully", user });
    } catch (error) {
        res.status(500).json({ message: "Error updating account details", error: error.message });
    }
});

// Appearance Settings: Update theme
router.put("/appearance", authMiddleware, async (req, res) => {
    try {
        const { theme } = req.body;
        if (!["light", "dark"].includes(theme)) {
            return res.status(400).json({ message: "Invalid theme selection" });
        }
        const user = await User.findByIdAndUpdate(req.user.id, { theme }, { new: true });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        res.json({ message: "Theme updated successfully", theme: user.theme });
    } catch (error) {
        res.status(500).json({ message: "Error updating theme", error: error.message });
    }
});

// Privacy Settings: Change password
router.put("/privacy", authMiddleware, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: "Current password is incorrect" });
        }

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        await user.save();

        res.json({ message: "Password updated successfully" });
    } catch (error) {
        res.status(500).json({ message: "Error updating password", error: error.message });
    }
});

module.exports = router;