const mongoose = require("mongoose");

const MaintenanceRequestSchema = new mongoose.Schema({
    student: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "User",
        required: true 
    },
    room: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "Room",
        required: true 
    },
    problemType: {
        type: String,
        enum: ["electrical", "plumbing", "furniture", "cleaning", "other"],
        required: true
    },
    description: {
        type: String,
        required: true
    },
    availableTime: {
        day: { type: Date, required: true },
        timeSlot: { type: String, required: true } // "13:30-14:30"
    },
    status: {
        type: String,
        enum: ["pending", "approved", "rejected", "completed"],
        default: "pending"
    },
    adminResponse: String,
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("MaintenanceRequest", MaintenanceRequestSchema);