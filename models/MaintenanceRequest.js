const mongoose = require("mongoose");

const MaintenanceRequestSchema = new mongoose.Schema({
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    blockName: { type: String, required: true },
    roomNumber: { type: Number, required: true },
    description: { type: String, required: true },
    status: { type: String, enum: ["pending", "in progress", "resolved"], default: "pending" },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("MaintenanceRequest", MaintenanceRequestSchema);
