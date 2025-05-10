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
    issues: {
        type: [String],
        required: true,
        validate: {
            validator: function(issues) {
                // Regex allows letters, numbers, spaces, and common punctuation
                const regex = /^[a-zA-Z0-9\s\-\/,.'()]+$/;
                return issues.every(issue => 
                    issue.trim().length > 0 &&  // Not empty
                    regex.test(issue)          // Matches allowed characters
                );
            },
            message: "Issues can only contain letters, numbers, spaces, hyphens (-), commas (,), slashes (/), apostrophes ('), or parentheses ()"
        }
    },
    urgency: {
        type: String,
        enum: ["Low", "Medium", "High"], // Keep enum for urgency
        default: "Medium"
    },
    additionalDescription: String,
    availableTime: {
        day: {
            type: String,
            required: false // Made optional
        },
        timeSlot: {
            type: String,
            required: false // Made optional
        }
    },
    description: {
        type: String,
        required: false // Made optional
    },
    problemType: {
        type: String,
        required: false // Made optional
    },
    status: {
        type: String,
        enum: ["Pending", "In Progress", "Completed", "Rejected"],
        default: "Pending"
    },
    adminResponse: String,
    admin: {
        type: mongoose.Schema.Types.ObjectId, // Added reference to admin who responded
        ref: "User",
        required: false
    },
    createdAt: { 
        type: Date, 
        default: Date.now 
    }
});

module.exports = mongoose.model("MaintenanceRequest", MaintenanceRequestSchema);