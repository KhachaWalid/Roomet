const express = require("express");
const Notification = require("../models/Notification");
const roleMiddleware = require("../middleware/roleMiddleware");

const router = express.Router();

// Get all notifications for the logged-in user
router.get("/", async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const notifications = await Notification.find({ recipient: req.session.user.id })
            .sort({ createdAt: -1 });
        res.json({ success: true, notifications });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to fetch notifications", error: error.message });
    }
});

// Mark a notification as read
router.patch("/:id/read", async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const notification = await Notification.findOneAndUpdate(
            { _id: req.params.id, recipient: req.session.user.id },
            { isRead: true, readAt: new Date() },
            { new: true }
        );
        if (!notification) {
            return res.status(404).json({ success: false, message: "Notification not found" });
        }
        res.json({ success: true, notification });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to mark as read", error: error.message });
    }
});

// Delete a notification
router.delete("/:id", async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const deleted = await Notification.findOneAndDelete({ _id: req.params.id, recipient: req.session.user.id });
        if (!deleted) {
            return res.status(404).json({ success: false, message: "Notification not found" });
        }
        res.json({ success: true, message: "Notification deleted" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to delete notification", error: error.message });
    }
});

// Mark all notifications as read
router.patch("/read-all", async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        await Notification.updateMany(
            { recipient: req.session.user.id, isRead: false },
            { isRead: true, readAt: new Date() }
        );
        res.json({ success: true, message: "All notifications marked as read" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to mark all as read", error: error.message });
    }
});

module.exports = router;
