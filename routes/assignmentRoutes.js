const express = require("express");
const Room = require("../models/Room");
const User = require("../models/User");
const BaccalaureateSerial = require("../models/BaccalaureateSerial");
const roleMiddleware = require("../middleware/roleMiddleware");

const router = express.Router();

router.post("/", roleMiddleware("director"), async (req, res) => {
    try {
        const { roomId, email, phone, serialNumber } = req.body;

        // 1. Validate required fields
        if (!roomId || !serialNumber) {
            return res.status(400).json({ message: "Room ID and serial number are required" });
        }

        // 2. Find records
        const [room, serialRecord] = await Promise.all([
            Room.findById(roomId),
            BaccalaureateSerial.findOne({ serialNumber })
        ]);

        if (!room) return res.status(404).json({ message: "Room not found" });
        if (!serialRecord) return res.status(404).json({ message: "Invalid serial number" });
        if (!serialRecord.registrationFeesPaid) {
            return res.status(400).json({ message: "Registration fees not paid" });
        }

        // 3. Create/update student
        let student = await User.findOne({ serialNumber });
        if (!student) {
            student = new User({
                firstName: serialRecord.firstName, // Fixed: Use from serialRecord
                lastName: serialRecord.lastName,   // Fixed: Use from serialRecord
                phone,
                email,
                serialNumber,
                role: "student"
            });
            await student.save();
        }

        // 4. Assign to room
        await room.addStudent(student._id);
        
        res.json({ 
            success: true,
            message: "Student assigned successfully",
            room: await Room.findById(roomId).populate('students')
        });

    } catch (error) {
        console.error("[ASSIGNMENT ERROR]", error);
        res.status(500).json({ 
            success: false,
            message: "Assignment failed",
            error: error.message 
        });
    }
});

// Delete student
router.delete("/student/:studentId", roleMiddleware("director"), async (req, res) => {
    try {
        const { studentId } = req.params;

        // Find and remove student from their room
        const room = await Room.findOne({ students: studentId });
        if (room) {
            room.students = room.students.filter(id => id.toString() !== studentId);
            // Update room status based on new occupancy
            if (room.students.length === 0) {
                room.status = "free";
            } else if (room.students.length < room.capacity) {
                room.status = "halfOccupied";
            }
            await room.save();
        }

        // Delete student's user record
        await User.findByIdAndDelete(studentId);

        res.json({ 
            success: true,
            message: "Student deleted successfully"
        });

    } catch (error) {
        console.error("[DELETE STUDENT ERROR]", error);
        res.status(500).json({ 
            success: false,
            message: "Failed to delete student",
            error: error.message 
        });
    }
});

module.exports = router;