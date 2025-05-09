const express = require("express");
const Block = require("../models/Block");
const Room = require("../models/Room");
const roleMiddleware = require("../middleware/roleMiddleware");

const router = express.Router();

// Simplified logic for block names and uniform room capacity
router.post("/initialize", roleMiddleware("director"), async (req, res) => {
    try {
        const { numberofBlocks, floors, roomsPerFloor, RoomsCapacity } = req.body;

        console.log("Request received with data:", req.body);

        // Validate input data
        if (!numberofBlocks || !floors || !roomsPerFloor || !RoomsCapacity) {
            return res.status(400).json({ message: "All fields are required" });
        }

        // Convert roomsPerFloor to an array if it's a single number
        const roomsPerFloorArray = Array(floors).fill(roomsPerFloor);

        // Generate block names from A to Z
        const blockNames = Array.from({ length: numberofBlocks }, (_, i) => String.fromCharCode(65 + i));

        console.log("Generated block names:", blockNames);

        // Create blocks and rooms
        const blockCreationPromises = [];
        const roomCreationPromises = [];

        for (let i = 0; i < numberofBlocks; i++) {
            const blockName = blockNames[i];
            const block = new Block({
                name: blockName,
                floors,
                roomsPerFloor: roomsPerFloorArray
            });
            console.log(`Creating block: ${blockName}`);
            await block.save();

            // Create rooms for the block
            for (let floor = 1; floor <= floors; floor++) {
                for (let j = 1; j <= roomsPerFloorArray[floor - 1]; j++) {
                    const roomNumber = `${blockName}${floor}${String(j).padStart(2, '0')}`;
                    const room = new Room({
                        number: roomNumber,
                        block: block._id,
                        floor,
                        capacity: RoomsCapacity 
                    });
                    console.log(`Creating room: ${roomNumber} with capacity: ${RoomsCapacity}`);
                    roomCreationPromises.push(room.save());
                }
            }
        }

        await Promise.all([...blockCreationPromises, ...roomCreationPromises]);

        res.status(201).json({
            message: "Blocks and rooms created successfully"
        });
    } catch (error) {
        console.error("Error during block and room creation:", error);
        res.status(500).json({
            message: "Error creating blocks and rooms",
            error: error.message
        });
    }
});

router.post("/create-block", roleMiddleware("director"), async (req, res) => {
    try {
        const { name, floors , roomsPerFloor , } = req.body;

        // Validate roomsPerFloor array matches number of floors

        

        // Create block
        const block = new Block({ name, floors, roomsPerFloor });
        await block.save();

        // Create rooms
        const roomCreationPromises = [];
        for (let floor = 1; floor <= block.floors; floor++) {
            for (let i = 1; i <= block.roomsPerFloor[floor - 1]; i++) {
                roomCreationPromises.push(
                    new Room({
                        number: `${floor}${String(i).padStart(2, '0')}`,
                        block: block._id,
                        floor
                    }).save()
                );
            }
        }
        await Promise.all(roomCreationPromises);

        res.status(201).json({
            message: "Block and rooms created successfully",
            block
        });

    } catch (error) {
        res.status(500).json({ 
            message: "Error creating block", 
            error: error.message 
        });
    }
});

// Get all blocks with room counts


// Add a route to get all blocks with the number of reports and students in each block
router.get("/", roleMiddleware("director"), async (req, res) => {
    try {
        const blocks = await Block.aggregate([
            {
                $lookup: {
                    from: "rooms",
                    localField: "_id",
                    foreignField: "block",
                    as: "rooms"
                }
            },
            {
                $lookup: {
                    from: "maintenancerequests",
                    localField: "_id",
                    foreignField: "block",
                    as: "reports"
                }
            },
            {
                $addFields: {
                    numberOfReports: { $size: "$reports" },
                    numberOfStudents: {
                        $sum: {
                            $map: {
                                input: "$rooms",
                                as: "room",
                                in: { $size: "$$room.students" }
                            }
                        }
                    }
                }
            },
            {
                $project: {
                    name: 1,
                    floors: 1,
                    numberOfReports: 1,
                    numberOfStudents: 1
                }
            }
        ]);

        res.json(blocks);
    } catch (error) {
        res.status(500).json({
            message: "Error fetching blocks summary",
            error: error.message
        });
    }
});

// Updated to calculate the total number of students in each block
router.get("/", roleMiddleware("director"), async (req, res) => {
    try {
        const blocks = await Block.aggregate([
            {
                $lookup: {
                    from: "rooms",
                    localField: "_id",
                    foreignField: "block",
                    as: "rooms"
                }
            },
            {
                $lookup: {
                    from: "maintenancerequests",
                    localField: "_id",
                    foreignField: "block",
                    as: "reports"
                }
            },
            {
                $addFields: {
                    numberOfReports: { $size: "$reports" },
                    totalStudents: {
                        $sum: {
                            $map: {
                                input: "$rooms",
                                as: "room",
                                in: { $size: "$$room.students" }
                            }
                        }
                    }
                }
            },
            {
                $project: {
                    name: 1,
                    floors: 1,
                    numberOfReports: 1,
                    totalStudents: 1,
                    rooms: {
                        number: 1,
                        floor: 1,
                        students: 1
                    }
                }
            }
        ]);

        res.json(blocks);
    } catch (error) {
        res.status(500).json({
            message: "Error fetching blocks summary",
            error: error.message
        });
    }
});

module.exports = router;