const mongoose = require("mongoose");

const NotificationSchema = new mongoose.Schema({
    recipient: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "User",
        required: true 
    },
    message: { type: String, required: true },
    relatedRequest: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "MaintenanceRequest" 
    },
    isRead: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Notification", NotificationSchema);