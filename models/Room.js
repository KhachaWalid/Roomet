const mongoose = require("mongoose");

const RoomSchema = new mongoose.Schema({
    number: { 
        type: String, 
        required: true 
    },
    block: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "Block",
        required: true 
    },
    floor: { 
        type: Number, 
        required: true 
    },
    students: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "User" 
    }],
    capacity: { 
        type: Number, 
        default: 2 
    },
    status: {
        type: String,
        enum: ["occupied", "halfOccupied", "free"],
        default: "free",
        validate: {
            validator: function(v) {
                // Auto-update status based on occupancy
                if (this.students.length >= this.capacity) return v === "occupied";
                if (this.students.length > 0) return v === "halfOccupied";
                return v === "free";
            },
            message: "Status doesn't match actual occupancy!"
        }
    }
});

// Add student to room with auto-status update
RoomSchema.methods.addStudent = async function(studentId) {
    if (this.students.length >= this.capacity) {
        throw new Error("Room is at full capacity");
    }
    this.students.push(studentId);
    this.status = this.students.length === this.capacity ? "occupied" : "halfOccupied";
    return this.save();
};

module.exports = mongoose.model("Room", RoomSchema);