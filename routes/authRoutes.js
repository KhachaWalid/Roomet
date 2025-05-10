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
       
        // Check if email already exists
        const existingDirector = await User.findOne({ email, role: "director" });
        if (existingDirector) {
            return res.status(400).json({ message: "Email already registered" });
        }

        // Generate verification token
        const verificationToken = crypto.randomBytes(20).toString('hex');
        const verificationExpire = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

        const director = new User({
            firstName,
            lastName,
            email,
            password,
            role: "director",
            verificationToken,
            verificationExpire
        });

        await director.save();

        // Send verification email
        const verificationUrl = `http://localhost:3000/verification/${verificationToken}`;
        const mailOptions = {
            to: director.email,
            subject: 'Verify Your Email - E-Room Director Registration',
            html: `
                <h1>Welcome to E-Room!</h1>
                <p>Please verify your email by clicking the link below:</p>
                <a href="${verificationUrl}">Verify Email</a>
                <p>This link will expire in 24 hours.</p>
            `
        };

        await transporter.sendMail(mailOptions);

        res.status(201).json({ 
            message: "Director registered successfully. Please check your email to verify your account.",
            success: true
        });

    } catch (error) {
        res.status(500).json({ 
            message: "Error registering director", 
            error: error.message,
            success: false
        });
    }
});

router.get("/verify-email/:token", async (req, res) => {
    try {
        const { token } = req.params;
        console.log("Verification attempt for token:", token);

        const director = await User.findOne({
            verificationToken: token,
            verificationExpire: { $gt: Date.now() },
            role: "director"
        });

        if (!director) {
            console.log("No director found with token or token expired");
            return res.status(400).json({ 
                message: "Invalid or expired verification token",
                success: false
            });
        }

        console.log("Director found:", director.email);
        director.isVerified = true;
        director.verificationToken = undefined;
        director.verificationExpire = undefined;
        await director.save();
        console.log("Director verified successfully");

        res.status(200).json({ 
            message: "Email verified successfully!",
            success: true,
            director: {
                id: director._id,
                firstName: director.firstName,
                lastName: director.lastName,
                email: director.email
            }
        });

    } catch (error) {
        console.error("Verification error:", error);
        res.status(500).json({ 
            message: "Error verifying email", 
            error: error.message,
            success: false
        });
    }
});

router.post("/director-login", async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log("Login attempt for email:", email);

        const director = await User.findOne({ email, role: "director" });
        if (!director) {
            console.log("No director found with email:", email);
            return res.status(400).json({ 
                message: "Invalid email or password",
                success: false
            });
        }

        console.log("Director found, checking password and verification status");
        const isMatch = await bcrypt.compare(password, director.password);
        if (!isMatch) {
            console.log("Password mismatch");
            return res.status(400).json({ 
                message: "Invalid email or password",
                success: false
            });
        }

        // Check if email is verified
        if (!director.isVerified) {
            console.log("Director not verified:", director.email);
            return res.status(400).json({ 
                message: "Please verify your email before logging in",
                success: false
            });
        }

        console.log("Login successful for:", director.email);
        req.session.user = {
            id: director._id,
            firstName: director.firstName,
            lastName: director.lastName,
            email: director.email,
            role: "director"
        };

        res.status(200).json({ 
            message: "Director login successful", 
            director: req.session.user,
            success: true
        });

    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ 
            message: "Error logging in", 
            error: error.message,
            success: false
        });
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
        const { email, password } = req.body;

        // Find the student by email
        const student = await User.findOne({ email, role: "student" });
        if (!student) {
            return res.status(400).json({ message: "Invalid email or password" });
        }

        // Check if the password matches
        const isMatch = await bcrypt.compare(password, student.password);
        if (!isMatch) {
            return res.status(400).json({ message: "Invalid email or password" });
        }

        // Check if the student is verified (optional, if applicable)
        if (!student.isVerified) {
            return res.status(400).json({ message: "Please verify your email before logging in" });
        }

        // Set session data
        req.session.user = {
            id: student._id,
            firstName: student.firstName,
            lastName: student.lastName,
            email: student.email,
            role: "student"
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

// Resend verification email
router.post("/resend-verification", async (req, res) => {
    try {
        const { email } = req.body;
        console.log("Resending verification for email:", email);

        const director = await User.findOne({ email, role: "director" });
        if (!director) {
            return res.status(404).json({ 
                message: "Director not found",
                success: false
            });
        }

        if (director.isVerified) {
            return res.status(400).json({ 
                message: "Email already verified",
                success: false
            });
        }

        // Generate new verification token
        const verificationToken = crypto.randomBytes(20).toString('hex');
        const verificationExpire = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

        director.verificationToken = verificationToken;
        director.verificationExpire = verificationExpire;
        await director.save();

        // Send verification email
        const verificationUrl = `http://localhost:3000/api/auth/verify-email/${verificationToken}`;
        const mailOptions = {
            to: director.email,
            subject: 'Verify Your Email - E-Room Director Registration',
            html: `
                <h1>Welcome to E-Room!</h1>
                <p>Please verify your email by clicking the link below:</p>
                <a href="${verificationUrl}">Verify Email</a>
                <p>This link will expire in 24 hours.</p>
            `
        };

        await transporter.sendMail(mailOptions);

        res.status(200).json({ 
            message: "Verification email sent successfully",
            success: true
        });

    } catch (error) {
        console.error("Resend verification error:", error);
        res.status(500).json({ 
            message: "Error sending verification email", 
            error: error.message,
            success: false
        });
    }
});

router.get("/is-logged-in", (req, res) => {
    if (req.session && req.session.user) {
        res.status(200).json({ loggedIn: true, user: req.session.user });
    } else {
        res.status(200).json({ loggedIn: false });
    }
});

module.exports = router;
