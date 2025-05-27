const express = require("express");
const User = require("../models/User");
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

// Universal forgot password (for director, admin, student)
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    // Try to find user by email (any role)
    const user = await User.findOne({ email });
    if (!user) {
        return res.status(404).json({ message: "No user found with this email." });
    }
    const resetToken = crypto.randomBytes(20).toString('hex');
    user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.resetPasswordExpire = Date.now() + 3600000; // 1 hour
    await user.save();
    const resetUrl = `http://localhost:3000/resetPassword/${resetToken}`;
    const mailOptions = {
        to: user.email,
        subject: 'Password Reset Request',
        text: `Click this link to reset your password: ${resetUrl}`
    };
    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: "Reset email sent!" });
});

// Universal reset password (for director, admin, student)
router.post('/reset-password/:token', async (req, res) => {
    const { token } = req.params;
    const { password } = req.body;
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    // Find user by reset token and expiry (any role)
    const user = await User.findOne({
        resetPasswordToken: hashedToken,
        resetPasswordExpire: { $gt: Date.now() }
    });
    if (!user) {
        return res.status(400).json({ message: "Invalid or expired token." });
    }
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();
    res.status(200).json({ message: "Password updated successfully!" });
});


// Register admin (director only, with activation email)
router.post("/register-admin", roleMiddleware("director"), async (req, res) => {
    try {
        const { email, phone, firstName, lastName } = req.body;
        if (!email || !phone || !firstName || !lastName) {
            return res.status(400).json({ message: "All fields are required" });
        }
        // Check if admin already exists
        let admin = await User.findOne({ email, role: "admin" });
        if (admin) {
            return res.status(400).json({ message: "Admin with this email already exists" });
        }
        // Generate activation token
        const activationToken = crypto.randomBytes(20).toString('hex');
        const activationExpire = Date.now() + 10 * 24 * 60 * 60 * 1000; // 10 days
        admin = new User({
            firstName,
            lastName,
            email,
            phone,
            role: "admin",
            activationToken,
            activationExpire,
            isVerified: false
            // No password at this stage
        });
        await admin.save();
        // Send activation email
        const activationUrl = `http://localhost:3000/activation/${activationToken}`;
        const mailOptions = {
            to: admin.email,
            subject: 'Activate Your Admin Account',
            html: `
                <h1>Welcome to ROOMET Admin!</h1>
                <p>You have been assigned as an admin. Please activate your account by clicking the link below and set your password:</p>
                <a href="${activationUrl}">Activate Account</a>
                <p>This link will expire in 10 days.</p>
            `
        };
        await transporter.sendMail(mailOptions);
        res.status(201).json({ message: "Admin registered. Activation email sent." });
    } catch (error) {
        res.status(500).json({ message: "Error registering admin", error: error.message });
    }
});

// Unified account activation route for admin and student
router.post("/activate/:token", async (req, res) => {
    try {
        const { token } = req.params;
        const { password } = req.body;
        if (!password || password.length < 6) {
            return res.status(400).json({ message: "Password must be at least 6 characters." });
        }
        // Find user (admin or student) by activationToken and activationExpire
        const user = await User.findOne({ activationToken: token, activationExpire: { $gt: Date.now() }, role: { $in: ["admin", "student"] } });
        if (!user) {
            return res.status(400).json({ message: "Invalid or expired activation token." });
        }
        user.password = password;
        user.isVerified = true;
        user.activationToken = undefined;
        user.activationExpire = undefined;
        await user.save();
        res.json({ success: true, message: `${user.role.charAt(0).toUpperCase() + user.role.slice(1)} account activated. You can now log in.` });
    } catch (error) {
        res.status(500).json({ success: false, message: "Activation failed", error: error.message });
    }
});

// Universal login for student, admin, and director
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        let user;
        let role;

        // Find user by email (admin, director, or student)
        user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: "Invalid email or password", success: false });
        }
        role = user.role;

        // Password check for all roles
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: "Invalid email or password", success: false });
        }

        // Verification/activation checks
        if (role === "director" && !user.isVerified) {
            return res.status(400).json({ message: "Please verify your email before logging in", success: false });
        }
        if (role === "student" && !user.isVerified) {
            return res.status(400).json({ message: "Please activate your account from your email before logging in", success: false });
        }
        if (role === "admin" && user.activationToken) {
            return res.status(400).json({ message: "Please activate your admin account from your email before logging in", success: false });
        }

        // Set session data
        req.session.user = {
            id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            role: user.role,
            adminCode: user.adminCode
        };

        res.status(200).json({ 
            message: `${role.charAt(0).toUpperCase() + role.slice(1)} login successful`,
            user: req.session.user,
            success: true
        });
    } catch (error) {
        res.status(500).json({ message: "Error logging in", error: error.message, success: false });
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
