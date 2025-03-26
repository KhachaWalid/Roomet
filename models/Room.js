const mongoose = require("mongoose");

const RoomSchema = new mongoose.Schema({
    roomNumber: { type: Number, required: true }, 
    blockName: { type: String, required: true }, 
    floor: { type: Number, required: true }, 
    students: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], 
    status: { type: String, enum: ["occupied", "halfOccupied", "free"], default: "free" },
    capacity: { type: Number, default: 2 },
    supplies: {  
        tables: { type: Number, default: 2 },
        chairs: { type: Number, default: 2 },
        beds: { type: Number, default: 2 },
        shelves: { type: Number, default: 6 }
    }
});

module.exports = mongoose.model("Room", RoomSchema);
