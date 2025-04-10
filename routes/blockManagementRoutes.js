const express = require("express");
const Block = require("../models/Block");
const Room = require("../models/Room");
const roleMiddleware = require("../middleware/roleMiddleware");

const router = express.Router();

// Create new block with rooms
router.post("/", roleMiddleware("director"), async (req, res) => {
    try {
        const { name, floors, roomsPerFloor } = req.body;

        // Validate roomsPerFloor array matches number of floors
        if (roomsPerFloor.length !== floors) {
            return res.status(400).json({ 
                message: "Rooms per floor must be specified for each floor" 
            });
        }

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
                $addFields: {
                    occupiedRooms: {
                        $size: {
                            $filter: {
                                input: "$rooms",
                                as: "room",
                                cond: { $eq: ["$$room.status", "occupied"] }
                            }
                        }
                    }
                }
            }
        ]);

        res.json(blocks);
    } catch (error) {
        res.status(500).json({ 
            message: "Error fetching blocks", 
            error: error.message 
        });
    }
});

module.exports = router;