const mongoose = require("mongoose");

const BaccalaureateSerialSchema = new mongoose.Schema({
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    serialNumber: { type: String, unique: true, required: true },
    secretNumber: { type: String, required: true },
    registrationFeesPaid: { type: Boolean, default: false } 
});

module.exports = mongoose.model("BaccalaureateSerial", BaccalaureateSerialSchema);