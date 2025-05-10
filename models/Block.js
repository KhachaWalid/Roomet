const mongoose = require("mongoose");
const Room = require("./Room");

const BlockSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true, 
        unique: true 
    },
    floors: { 
        type: Number, 
        required: true 
    },
    roomsPerFloor: [{ 
        type: Number, 
        required: true 
    }],
    totalRooms: { 
        type: Number,
        default: function () {
            return this.roomsPerFloor.reduce((sum, num) => sum + num, 0);
        }
    },
    reports: {
        type: Number,
        default: 0
    },
    students: {
        type: Number,
        default: 0
    },
    roomsCapacity: {
        type: Number,
        required: true 
    }
});

// Middleware to delete associated rooms when a block is removed
BlockSchema.pre('remove', async function(next) {
    await Room.deleteMany({ block: this._id });
    next();
});

module.exports = mongoose.model("Block", BlockSchema);