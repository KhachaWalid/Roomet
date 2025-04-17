const express = require("express");
const MaintenanceRequest = require("../models/MaintenanceRequest");
const Notification = require("../models/Notification");
const User = require("../models/User");
const Room = require("../models/Room");
const roleMiddleware = require("../middleware/roleMiddleware");

const router = express.Router();

// Student submits request
router.post("/", roleMiddleware("student"), async (req, res) => {
    try {
        const { problemType, description, day, timeSlot } = req.body;
        const studentId = req.session.user.id;

        // Find student's room
        const room = await Room.findOne({ students: studentId });
        if (!room) {
            return res.status(400).json({ message: "Student not assigned to any room" });
        }

        // Create request
        const request = new MaintenanceRequest({
            student: studentId,
            room: room._id,
            problemType,
            description,
            availableTime: { day, timeSlot }
        });
        await request.save();

        // Notify all admins
        const admins = await User.find({ role: "admin" });
        await Promise.all(admins.map(admin => 
            new Notification({
                recipient: admin._id,
                message: `New maintenance request from room ${room.number}`,
                relatedRequest: request._id
            }).save()
        ));

        res.status(201).json(request);
    } catch (error) {
        res.status(500).json({ message: "Error submitting request", error: error.message });
    }
});

// Admin views all requests
router.get("/", roleMiddleware("admin"), async (req, res) => {
    try {
        const requests = await MaintenanceRequest.find()
            .populate("student", "firstName lastName")
            .populate("room", "number block");
        res.json(requests);
    } catch (error) {
        res.status(500).json({ message: "Error fetching requests", error: error.message });
    }
});

// Admin responds to request
router.patch("/:id/respond", roleMiddleware("admin"), async (req, res) => {
    try {
        const { status, response } = req.body;
        
        const request = await MaintenanceRequest.findByIdAndUpdate(
            req.params.id,
            { status, adminResponse: response },
            { new: true }
        );

        // Notify student
        await new Notification({
            recipient: request.student,
            message: `Your maintenance request was ${status}, response: ${response}`,
            relatedRequest: request._id
        }).save();

        res.json(request);
    } catch (error) {
        res.status(500).json({ message: "Error responding to request", error: error.message });
    }
});

// Get user notifications
router.get("/notifications", roleMiddleware(), async (req, res) => {
    try {
        const notifications = await Notification.find({
            recipient: req.session.user.id,
            isRead: false
        }).sort({ createdAt: -1 });
        
        res.json(notifications);
    } catch (error) {
        res.status(500).json({ message: "Error fetching notifications", error: error.message });
    }
});

// Mark notification as read
router.patch("/notifications/:id/read", roleMiddleware(), async (req, res) => {
    try {
        await Notification.findByIdAndUpdate(
            req.params.id,
            { isRead: true }
        );
        res.json({ message: "Notification marked as read" });
    } catch (error) {
        res.status(500).json({ message: "Error updating notification", error: error.message });
    }
});

module.exports = router;