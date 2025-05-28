const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const UserSchema = new mongoose.Schema({
    // General user info
    firstName: { type: String, sparse: true },
    lastName: { type: String, sparse: true },
    email: { type: String, unique: true, sparse: true }, // Used for all roles
    password: { type: String, sparse: true }, // Used for all roles
    role: { type: String, enum: ["student", "admin", "director"], required: true },

    // Password reset and verification
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    isVerified: { type: Boolean, default: false }, 
    verificationToken: String, 
    verificationExpire: Date, 
    activationToken: String, 
    activationExpire: Date, 

    // Student-specific fields
    phone: { type: String, sparse: true },
    studentId: { type: String, unique: true, sparse: true },

    // Room assignment
    room: { type: mongoose.Schema.Types.ObjectId, ref: "Room", sparse: true }
});

//  Hash director's password before saving
UserSchema.pre("save", async function (next) {
    if (!this.isModified("password") || !this.password) return next();
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

module.exports = mongoose.model("User", UserSchema);
