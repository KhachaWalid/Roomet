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
        required: false 
    },
    isRead: { type: Boolean, default: false },
    readAt: {
        type: Date, 
        default: null
    },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Notification", NotificationSchema);