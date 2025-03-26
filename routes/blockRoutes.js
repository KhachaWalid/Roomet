const express = require("express");
const Block = require("../models/Block");
const Room = require("../models/Room");
const BaccalaureateSerial = require("../models/BaccalaureateSerial");
const roleMiddleware = require("../middleware/roleMiddleware");
const User = require("../models/User");

const router = express.Router();

router.post("/create", roleMiddleware("director"), async (req, res) => {
    try {
        const { name, numberOfFloors, numberOfRooms, roomsPerFloor } = req.body;

      
        if (roomsPerFloor.length !== numberOfFloors) {
            return res.status(400).json({ message: "Rooms per floor count must match number of floors." });
        }

        const totalRooms = roomsPerFloor.reduce((sum, num) => sum + num, 0);
        if (totalRooms !== numberOfRooms) {
            return res.status(400).json({ message: "Total rooms must match sum of rooms per floor." });
        }

        
        const newBlock = new Block({ name, numberOfFloors, numberOfRooms, roomsPerFloor });
        await newBlock.save();

        let roomCount = 1; 

        for (let floor = 0; floor < numberOfFloors; floor++) {
            for (let i = 1; i <= roomsPerFloor[floor]; i++) {
                let roomNumber = (floor === 0)
                    ? String(roomCount).padStart(2, '0')  
                    : `${floor}${String(i).padStart(2, '0')}`; 

                const room = new Room({ 
                    roomNumber, 
                    blockName: name, 
                    floor
                });

                await room.save();
                roomCount++;
            }
        }

        res.status(201).json({ message: "Block and rooms created successfully", block: newBlock });

    } catch (error) {
        console.error("Block Creation Error:", error);
        res.status(500).json({ message: "Error creating block", error: error.message });
    }
});


router.post("/assign-student", roleMiddleware("admin", "registration"), async (req, res) => {
    try {
        const { firstName, lastName, phone, email, serialNumber, blockName, roomNumber } = req.body;

       
        const serialRecord = await BaccalaureateSerial.findOne({ serialNumber });

        if (!serialRecord) {
            return res.status(400).json({ message: "Invalid serial number - Not found in records" });
        }

        
        if (!serialRecord.registrationFeesPaid) {
            return res.status(400).json({ message: "Student has not paid registration fees" });
        }

        
        let student = await User.findOne({ serialNumber });

        if (!student) {
           
            student = new User({
                firstName,
                lastName,
                phone,
                email: email || null, 
                serialNumber,
                role: "student"
            });
            await student.save();
        }

       
        const room = await Room.findOne({ blockName, roomNumber });

        if (!room) {
            return res.status(404).json({ message: "Room not found in this block" });
        }

        
        if (room.students.length >= 2) {
            return res.status(400).json({ message: "Room is already full" });
        }

        
        room.students.push(student._id);

        
        if (room.students.length === 1) {
            room.status = "halfOccupied"; // 1 student in room
        } else if (room.students.length === 2) {
            room.status = "occupied"; // 2 students in room
        }

        await room.save();

        res.status(200).json({ message: "Student registered and assigned successfully", room });

    } catch (error) {
        res.status(500).json({ message: "Error assigning student", error: error.message });
    }
});


module.exports = router;

