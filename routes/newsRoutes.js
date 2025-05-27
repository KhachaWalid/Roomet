const express = require("express");
const Notification = require("../models/Notification");
const User = require("../models/User");
const roleMiddleware = require("../middleware/roleMiddleware");
const multer = require("multer");
const path = require("path");
const nodemailer = require("nodemailer");

const router = express.Router();

// Multer setup for file uploads (images or pdf)
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "uploads/news/");
    },
    filename: function (req, file, cb) {
        const ext = path.extname(file.originalname);
        cb(null, Date.now() + "-news" + ext);
    }
});
const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        const allowed = [".jpg", ".jpeg", ".png", ".gif", ".pdf"];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowed.includes(ext)) cb(null, true);
        else cb(new Error("Only images and PDF files are allowed"));
    }
});

// Configure nodemailer transporter (reuse from authRoutes if possible)
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Post news (director or admin)
router.post("/news", roleMiddleware("director"), upload.single("file"), async (req, res, next) => {
    if (req.session.user.role !== "director" && req.session.user.role !== "admin") {
        return res.status(403).json({ message: "Forbidden - Only director or admin can post news" });
    }
    try {
        if (!req.file) {
            return res.status(400).json({ message: "A file (image or PDF) is required" });
        }
        const fileUrl = `/uploads/news/${req.file.filename}`;
        // Send news to all users except the sender
        const users = await User.find({ _id: { $ne: req.session.user.id } });
        const notifications = users.map(user => ({
            recipient: user._id,
            message: `[NEWS] File uploaded: ${fileUrl}`
        }));
        await Notification.insertMany(notifications);
        // Send email to all users (if they have an email)
        for (const user of users) {
            if (user.email) {
                await transporter.sendMail({
                    to: user.email,
                    subject: 'New News Announcement',
                    html: `<p>A new news file has been posted. <a href="${fileUrl}">View file</a></p>`
                });
            }
        }
        res.status(201).json({ success: true, message: "News file sent to all users", fileUrl });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to post news", error: error.message });
    }
});

// Get all news (files posted as news)
router.get("/news", async (req, res) => {
    try {
        // Find all notifications that are news (message starts with [NEWS] File uploaded:)
        const newsNotifications = await Notification.find({ message: { $regex: /^\[NEWS\] File uploaded:/ } })
            .sort({ createdAt: -1 });
        // Extract file URLs and createdAt
        const news = newsNotifications.map(n => ({
            id: n._id,
            fileUrl: n.message.replace(/^\[NEWS\] File uploaded: /, ""),
            createdAt: n.createdAt
        }));
        res.json({ success: true, news });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to fetch news", error: error.message });
    }
});

module.exports = router;
