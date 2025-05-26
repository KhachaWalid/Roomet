const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const UserSchema = new mongoose.Schema({
    firstName: { type: String, sparse: true },
    lastName: { type: String, sparse: true },
    email: { type: String, unique: true, sparse: true }, // 🔹 Only for directors
    password: { type: String, sparse: true }, // 🔹 Only for directors
    role: { type: String, enum: ["student", "admin", "director"], required: true },
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    isVerified: { type: Boolean, default: false }, // New field for email verification
    verificationToken: String, // New field for verification token
    verificationExpire: Date, // New field for verification token expiry
    activationToken: String, // For student account activation
    activationExpire: Date, // Expiry for activation token
    
    // 🔹 Only for admins
    adminCode: { type: String, unique: true, sparse: true },
    secretNumber: { type: String, sparse: true }, 

    // 🔹 Only for students
    serialNumber: { type: String, unique: true, sparse: true },
    phone: { type: String, sparse: true },

    room: { type: mongoose.Schema.Types.ObjectId, ref: "Room", sparse: true }
});

// 🔒 Hash director's password before saving
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
