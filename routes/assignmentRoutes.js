const express = require("express");
const Room = require("../models/Room");
const User = require("../models/User");
const BaccalaureateSerial = require("../models/BaccalaureateSerial");
const roleMiddleware = require("../middleware/roleMiddleware");

const router = express.Router();

// Assign student to room
router.post("/", roleMiddleware("director"), async (req, res) => {
    try {
        const { studentId, roomId } = req.body;

        // Find room and student
        const room = await Room.findById(roomId);
        const student = await User.findById(studentId);

        if (!room || !student) {
            return res.status(404).json({ 
                message: "Room or student not found" 
            });
        }

        // Check serial number validity
        const serialValid = await BaccalaureateSerial.findOne({ 
            serialNumber: student.serialNumber,
            registrationFeesPaid: true
        });

        if (!serialValid) {
            return res.status(400).json({ 
                message: "Invalid serial number or unpaid fees" 
            });
        }

        // Assign student
        await room.addStudent(student._id);
        
        res.json({ 
            message: "Student assigned successfully",
            room 
        });

    } catch (error) {
        res.status(500).json({ 
            message: "Assignment failed", 
            error: error.message 
        });
    }
});

// Get available rooms in a block
router.get("/available/:blockId", roleMiddleware("admin"), async (req, res) => {
    try {
        const rooms = await Room.find({
            block: req.params.blockId,
            status: { $ne: "occupied" }
        }).populate("block", "name");

        res.json(rooms);
    } catch (error) {
        res.status(500).json({ 
            message: "Error fetching rooms", 
            error: error.message 
        });
    }
});

module.exports = router;