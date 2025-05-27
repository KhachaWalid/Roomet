const express = require("express");
const Room = require("../models/Room");
const Block = require("../models/Block");
const roleMiddleware = require("../middleware/roleMiddleware");

const router = express.Router();

// room creation
router.post("/create-room", roleMiddleware("director"), async (req, res) => {
    try {
        const { number, blockId } = req.body; 

        if (!number || !blockId) {
            return res.status(400).json({ message: "Number and Block are required" });
        }

        const block = await Block.findById(blockId);
        if (!block) {
            return res.status(404).json({ message: "Block not found" });
        }

        const room = new Room({
            number, 
            block: blockId, 
            reports: 0, 
            students: [], 
            status: "free" 
        });

        await room.save();

        res.status(201).json({ message: "Room created successfully", room });
    } catch (error) {
        res.status(500).json({ message: "Error creating room", error: error.message });
    }
});

router.get("/", roleMiddleware(["admin", "director"]), async (req, res) => {
    try {
        const rooms = await Room.find()
            .populate("block", "name")   // Ensure block name is populated
            .populate({
                path: "students",
                select: "firstName lastName email studentId"
            })  // Populate student details with all relevant fields
            .exec();

        const formatted = rooms.map(room => ({
            id: room._id,
            number: room.number,
            block: {
                id: room.block?._id || null, // Include block ID
                name: room.block?.name || "Unknown" // Include block name
            },
            floor: room.floor,
            capacity: room.capacity,
            currentOccupancy: room.students.length,
            students: room.students || [], // Include students array in response
            status: room.status
        }));

        res.json(formatted);  // Send back the formatted room data
    } catch (error) {
        res.status(500).json({ message: "Error fetching rooms", error: error.message });
    }
});

// Get one room by ID
router.get("/:id", roleMiddleware(["admin", "director"]), async (req, res) => {
    try {
        const { id } = req.params;
        const room = await Room.findById(id)
            .populate({ path: "block" })
            .populate({ path: "students" })
            .exec();
        if (!room) {
            return res.status(404).json({ message: "Room not found" });
        }
        // Fetch all maintenance requests for this room
        const reports = await require("../models/MaintenanceRequest").find({ room: id })
            .populate({ path: "student", select: "firstName lastName email studentId" })
            .sort({ createdAt: -1 });
        res.json({
            ...room.toObject(),
            reports // Array of detailed maintenance requests
        });
    } catch (error) {
        res.status(500).json({ message: "Error fetching room", error: error.message });
    }
});

module.exports = router;