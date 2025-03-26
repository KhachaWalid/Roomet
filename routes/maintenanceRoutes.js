const express = require("express");
const MaintenanceRequest = require("../models/MaintenanceRequest");
const Room = require("../models/Room");
const roleMiddleware = require("../middleware/roleMiddleware");
const multer = require("multer");

const router = express.Router();


const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, "uploads/"),
    filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname)
});

const upload = multer({ storage });


router.post("/request", upload.single("image"), async (req, res) => {
    try {
        if (!req.session.user || req.session.user.role !== "student") {
            return res.status(401).json({ message: "Unauthorized - Students only" });
        }

        const { description } = req.body;
        const imagePath = req.file ? `/uploads/${req.file.filename}` : null;
        const studentId = req.session.user.id;

        const room = await Room.findOne({ students: studentId }).populate("blockId", "name");
        if (!room) return res.status(404).json({ message: "Room not found" });

        const newRequest = new MaintenanceRequest({
            student: studentId,
            blockName: Room.BlockId.name,
            roomNumber: Room.RoomNumber,
            description,
            image: imagePath
        });

        await newRequest.save();
        res.status(201).json({ message: "Maintenance request submitted successfully", request: newRequest });

    } catch (error) {
        res.status(500).json({ message: "Error submitting maintenance request", error: error.message });
    }
});

module.exports = router;
