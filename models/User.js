const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const UserSchema = new mongoose.Schema({
    firstName: { type: String, sparse: true },
    lastName: { type: String, sparse: true },
    email: { type: String, unique: true, sparse: true }, // 🔹 Only for directors
    password: { type: String, sparse: true }, // 🔹 Only for directors
    role: { type: String, enum: ["student", "admin", "director"], required: true },

    // 🔹 Only for admins
    adminType: { type: String, enum: ["registration", "maintenance"], sparse: true },
    adminCode: { type: String, unique: true, sparse: true },
    secretNumber: { type: String, sparse: true }, 

    // 🔹 Only for students
    serialNumber: { type: String, unique: true, sparse: true },
    phone: { type: String, sparse: true }
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
