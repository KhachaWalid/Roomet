const express = require("express");
const User = require("../models/User");
const BaccalaureateSerial = require("../models/BaccalaureateSerial");
const roleMiddleware = require("../middleware/roleMiddleware");
const session = require("express-session");
const bcrypt = require("bcrypt");


const router = express.Router();


router.post("/register-director", async (req, res) => {
    try {
        const { firstName, lastName, email, password } = req.body;

    
        const existingDirector = await User.findOne({ role: "director" });
        if (existingDirector) {
            return res.status(400).json({ message: "A director is already registered" });
        }

       
        const director = new User({
            firstName,
            lastName,
            email,
            password,
            role: "director"
        });

        await director.save();
        res.status(201).json({ message: "Director registered successfully" });

    } catch (error) {
        res.status(500).json({ message: "Error registering director", error: error.message });
    }
});

router.post("/director-login", async (req, res) => {
    try {
        const { email, password } = req.body;

       
        const director = await User.findOne({ email, role: "director" });
        if (!director) {
            return res.status(400).json({ message: "Invalid email or password" });
        }

      
        const isMatch = await bcrypt.compare(password, director.password);
        if (!isMatch) {
            return res.status(400).json({ message: "Invalid email or password" });
        }

        req.session.user = {
            id: director._id,
            firstName: director.firstName,
            lastName: director.lastName,
            email: director.email,
            role: "director"
        };

        res.status(200).json({ message: "Director login successful", director: req.session.user });

    } catch (error) {
        res.status(500).json({ message: "Error logging in", error: error.message });
    }
});


router.post("/register-admin", roleMiddleware("director"), async (req, res) => {
    try {
        const { adminType, adminCode, secretNumber } = req.body;

        if (!["registration", "maintenance"].includes(adminType)) {
            return res.status(400).json({ message: "Invalid admin type" });
        }

       
        const existingAdmin = await User.findOne({ adminCode });
        if (existingAdmin) {
            return res.status(400).json({ message: "Admin code already in use" });
        }

     
        const newAdmin = new User({
            role: "admin",
            adminType,
            adminCode,
            secretNumber
        });

        await newAdmin.save();
        res.status(201).json({ message: "Admin registered successfully", admin: { adminType, adminCode } });

    } catch (error) {
        res.status(500).json({ message: "Error registering admin", error: error.message });
    }
});


router.post("/admin-login", async (req, res) => {
    try {
        const { adminCode, secretNumber } = req.body;

        
        const admin = await User.findOne({ adminCode, role: "admin" });

        if (!admin || admin.secretNumber !== secretNumber) {
            return res.status(400).json({ message: "Invalid admin code or secret number" });
        }

        
        req.session.user = {
            id: admin._id,
            adminType: admin.adminType,
            adminCode: admin.adminCode,
            role: "admin"
        };

        res.status(200).json({ message: "Admin login successful", admin: req.session.user });

    } catch (error) {
        res.status(500).json({ message: "Error logging in", error: error.message });
    }
});




router.post("/login", async (req, res) => {
    try {
        const { serialNumber, secretNumber } = req.body;

      
        const user = await User.findOne({ serialNumber });

        if (!user) {
            return res.status(400).json({ message: "Invalid serial number or secret number" });
        }

        
        const serialRecord = await BaccalaureateSerial.findOne({ serialNumber });

        if (!serialRecord || serialRecord.secretNumber !== secretNumber) {
            return res.status(400).json({ message: "Invalid serial number or secret number" });
        }

        req.session.user = {
            id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            serialNumber: user.serialNumber,
            role: user.role
        };

        res.status(200).json({ message: "Login successful", user: req.session.user });

    } catch (error) {
        res.status(500).json({ message: "Error logging in", error: error.message });
    }
});


router.post("/logout", (req, res) => {
    req.session.destroy((err) => {
        if (err) return res.status(500).json({ message: "Error logging out" });

        res.clearCookie("connect.sid", { path: "/", httpOnly: true, sameSite: "strict" }); // ✅ More secure logout
        res.status(200).json({ message: "Logged out successfully" });
    });
});

module.exports = router;
