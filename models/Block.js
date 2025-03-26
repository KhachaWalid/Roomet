const mongoose = require("mongoose");

const BlockSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true }, 
    numberOfFloors: { type: Number, required: true }, 
    numberOfRooms: { type: Number, required: true }, 
    roomsPerFloor: [{ type: Number, required: true }] 
});

module.exports = mongoose.model("Block", BlockSchema);
