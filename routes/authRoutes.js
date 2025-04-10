const express = require("express");
const User = require("../models/User");
const BaccalaureateSerial = require("../models/BaccalaureateSerial");
const roleMiddleware = require("../middleware/roleMiddleware");
const session = require("express-session");
const bcrypt = require("bcrypt");
const nodemailer = require('nodemailer');
const crypto = require('crypto'); 


const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS  
    }
});


const router = express.Router();


router.post("/register-director", async (req, res) => {
    try {
        const { firstName, lastName, email, password } = req.body;
       
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

router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;

    
    const director = await User.findOne({ email, role: 'director' });
    if (!director) {
        return res.status(404).json({ message: "No director found with this email." });
    }

    
    const resetToken = crypto.randomBytes(20).toString('hex');
    director.resetPasswordToken = crypto
        .createHash('sha256')
        .update(resetToken)
        .digest('hex');
    director.resetPasswordExpire = Date.now() + 3600000; // 1 hour
    await director.save();

    
    const resetUrl = `http://localhost:3000/reset-password/${resetToken}`;
    
    const mailOptions = {
        to: director.email,
        subject: 'Password Reset Request',
        text: `Click this link to reset your password: ${resetUrl}`
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ message: "Reset email sent!" });
});

router.post('/reset-password/:token', async (req, res) => {
    const { token } = req.params;
    const { password } = req.body;

   
    const hashedToken = crypto
        .createHash('sha256')
        .update(token)
        .digest('hex');

    
    const director = await User.findOne({
        resetPasswordToken: hashedToken,
        resetPasswordExpire: { $gt: Date.now() }, 
        role: 'director'
    });

    if (!director) {
        return res.status(400).json({ message: "Invalid or expired token." });
    }

    
    director.password = password;
    director.resetPasswordToken = undefined;
    director.resetPasswordExpire = undefined;
    await director.save();

    res.status(200).json({ message: "Password updated successfully!" });
});


router.post("/register-admin", roleMiddleware("director"), async (req, res) => {
    try {
        const { adminCode, secretNumber } = req.body;

    
        const existingAdmin = await User.findOne({ adminCode });
        if (existingAdmin) {
            return res.status(400).json({ message: "Admin code already in use" });
        }

     
        const newAdmin = new User({
            role: "admin",
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
