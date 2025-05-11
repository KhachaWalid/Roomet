const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const roleMiddleware = require("../middleware/roleMiddleware");
const MaintenanceRequest = require("../models/MaintenanceRequest");
const Room = require("../models/Room");
const User = require("../models/User");
const Notification = require("../models/Notification");

// Submit Maintenance Request (Student)
router.post("/", roleMiddleware("student"), async (req, res) => {
    try {
        const { issues, urgency, additionalDescription } = req.body;
        const studentId = req.session.user.id;

        // Validation
        if (!issues || !Array.isArray(issues) || issues.length === 0) {
            return res.status(400).json({ message: "At least one issue must be specified" });
        }

        // Find student's room
        const room = await Room.findOne({ students: studentId });
        if (!room) {
            return res.status(400).json({ message: "Student not assigned to any room" });
        }

        // Create and save request
        const request = new MaintenanceRequest({
            student: studentId,
            room: room._id,
            issues: issues.map(issue => issue.trim()), // Trim whitespace
            urgency: urgency || "Medium", // Default to Medium
            additionalDescription,
            status: "Pending"
        });
        await request.save();

        // Notify all admins
        const admins = await User.find({ role: "admin" });
        const notifications = admins.map(admin => ({
            recipient: admin._id,
            message: `New maintenance request from Room ${room.number}: ${issues.join(", ")}`,
            relatedRequest: request._id
        }));
        await Notification.insertMany(notifications);

        res.status(201).json(request);
    } catch (error) {
        if (error.name === "ValidationError") {
            return res.status(400).json({ message: "Invalid issue format", details: error.message });
        }
        console.error("[MAINTENANCE REQUEST ERROR]", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
});

// Admin: Get All Requests
router.get("/", roleMiddleware("director"), async (req, res) => {
    try {
        const requests = await MaintenanceRequest.find()
            .populate("student", "firstName lastName email")
            .populate({
                path: "room",
                populate: {
                    path: "block",
                    select: "-__v" // Exclude the __v field from the block
                },
                select: "-__v" // Exclude the __v field from the room
            })
            .sort({ createdAt: -1 });
        res.json(requests);
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch requests", error: error.message });
    }
});

// Admin: Update Request Status
router.patch("/:id/respond", roleMiddleware("admin"), async (req, res) => {
    try {
        const { status, response } = req.body;
        const request = await MaintenanceRequest.findByIdAndUpdate(
            req.params.id,
            { status, adminResponse: response },
            { new: true }
        ).populate("student", "email");

        if (!request) {
            return res.status(404).json({ message: "Request not found" });
        }

        // Notify student
        await new Notification({
            recipient: request.student._id,
            message: `Your request (${request.issues.join(", ")}) was ${status}. Response: ${response}`,
            relatedRequest: request._id
        }).save();

        res.json(request);
    } catch (error) {
        res.status(500).json({ message: "Failed to update request", error: error.message });
    }
});

module.exports = router;