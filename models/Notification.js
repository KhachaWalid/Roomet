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
        ref: "MaintenanceRequest",
        required: false // Kept optional
    },
    isRead: { type: Boolean, default: false },
    readAt: {
        type: Date, // Added timestamp for when the notification was read
        default: null
    },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Notification", NotificationSchema);