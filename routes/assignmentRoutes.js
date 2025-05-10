const express = require("express");
const Room = require("../models/Room");
const User = require("../models/User");
const roleMiddleware = require("../middleware/roleMiddleware");
const nodemailer = require("nodemailer"); // Add nodemailer for email functionality
const multer = require("multer"); // Add multer for file uploads
const csvParser = require("csv-parser"); // Add csv-parser for processing CSV files
const fs = require("fs");

const router = express.Router();

// Configure multer for file uploads
const upload = multer({ dest: "uploads/" });

router.post("/", roleMiddleware("director"), async (req, res) => {
    try {
        const { roomId, email, phone, studentId, firstName, lastName } = req.body;

        // 1. Validate required fields
        if (!email || !phone || !studentId || !firstName || !lastName) {
            return res.status(400).json({ message: "All fields except roomId are required" });
        }

        // 2. Create or update the student
        let student = await User.findOne({ studentId }).populate("room", "name"); // Populate room name
        if (!student) {
            student = new User({
                firstName,
                lastName,
                phone,
                email,
                studentId,
                role: "student"
            });
        }

        // 3. Check if roomId is provided
        if (roomId) {
            const room = await Room.findById(roomId);
            if (!room) return res.status(404).json({ message: "Room not found" });

            // Assign the student to the room
            room.students.push(student._id);
            if (room.students.length === room.capacity) {
                room.status = "full";
            } else {
                room.status = "halfOccupied";
            }
            await room.save();

            // Add room reference to the student
            student.room = room._id;
        }

        // 4. Send email to the student
        const transporter = nodemailer.createTransport({
            service: "gmail", // Use your email service
            auth: {
                user: process.env.EMAIL_USER, // Replace with your email
                pass: process.env.EMAIL_PASS  // Replace with your email password
            }
        });

        const mailOptions = {
            from: process.env.EMAIL_USER, // Replace with your email
            to: email,
            subject: "Create Your Account Password",
            text: `Hello ${firstName},

You have been successfully added to the system. ${roomId ? "You have been assigned to a room." : "You are currently unassigned to a room."} Please use the following link to create your password and log in:

[Create Password Link]

Thank you.`
        };

        try {
            await transporter.sendMail(mailOptions);
        } catch (emailError) {
            console.error("[EMAIL ERROR]", emailError);
            throw new Error("Failed to send email. Student not saved.");
        }

        // Save the student only if email is sent successfully
        await student.save();

        // Populate room name for the response
        await student.populate("room", "name");

        // If the student is not assigned to a room, set room name to "No room yet"
        const roomName = student.room ? student.room.name : "No room yet";

        res.json({ 
            success: true,
            message: `Student ${roomId ? "assigned to room and" : "added without room assignment and"} email sent`,
            student: {
                ...student.toObject(),
                room: roomName
            }
        });

    } catch (error) {
        console.error("[ASSIGNMENT ERROR]", error);
        res.status(500).json({ 
            success: false,
            message: "Assignment failed",
            error: error.message 
        });
    }
});

// Bulk upload students
router.post("/bulk", roleMiddleware("director"), upload.single("file"), async (req, res) => {
    try {
        const filePath = req.file.path;
        const students = [];

        // Parse the uploaded CSV file
        fs.createReadStream(filePath)
            .pipe(csvParser())
            .on("data", (row) => {
                students.push(row);
            })
            .on("end", async () => {
                const results = [];

                for (const studentData of students) {
                    const { roomId, email, phone, studentId, firstName, lastName } = studentData;

                    // Validate required fields
                    if (!email || !phone || !studentId || !firstName || !lastName) {
                        results.push({ studentId, success: false, message: "Missing required fields" });
                        continue;
                    }

                    // Check if roomId is provided
                    if (!roomId) {
                        // Create or update the student without assigning to a room
                        let student = await User.findOne({ studentId });
                        if (!student) {
                            student = new User({
                                firstName,
                                lastName,
                                phone,
                                email,
                                studentId,
                                role: "student"
                            });
                            await student.save();
                        }

                        // Add to results as unassigned
                        results.push({ studentId, success: true, message: "Student added without room assignment" });
                        continue;
                    }

                    try {
                        // Find the room
                        const room = await Room.findById(roomId);
                        if (!room) {
                            results.push({ studentId, success: false, message: "Room not found" });
                            continue;
                        }

                        // Create or update the student
                        let student = await User.findOne({ studentId });
                        if (!student) {
                            student = new User({
                                firstName,
                                lastName,
                                phone,
                                email,
                                studentId,
                                role: "student"
                            });
                        }

                        // Assign the student to the room
                        room.students.push(student._id);
                        if (room.students.length === room.capacity) {
                            room.status = "full";
                        } else {
                            room.status = "halfOccupied";
                        }
                        await room.save();

                        // Add room reference to the student
                        student.room = room._id;

                        // Send email to the student
                        const transporter = nodemailer.createTransport({
                            service: "gmail",
                            auth: {
                                user: process.env.EMAIL_USER,
                                pass: process.env.EMAIL_PASS
                            }
                        });

                        const mailOptions = {
                            from: process.env.EMAIL_USER,
                            to: email,
                            subject: "Create Your Account Password",
                            text: `Hello ${firstName},

You have been successfully added to the system. ${roomId ? `You have been assigned to the room: ${room.name}.` : "You are currently unassigned to a room."} Please use the following link to create your password and log in:

[Create Password Link]

Thank you.`
                        };

                        try {
                            await transporter.sendMail(mailOptions);
                        } catch (emailError) {
                            console.error("[EMAIL ERROR]", emailError);
                            results.push({ studentId, success: false, message: "Failed to send email. Student not saved." });
                            continue;
                        }

                        // Save the student only if email is sent successfully
                        await student.save();

                        // Populate room name for the response
                        await student.populate("room", "name");

                        // If the student is not assigned to a room, set room name to "No room yet"
                        const roomName = student.room ? student.room.name : "No room yet";

                        results.push({ 
                            studentId, 
                            success: true, 
                            message: "Student added and email sent", 
                            student: {
                                ...student.toObject(),
                                room: roomName
                            }
                        });
                    } catch (error) {
                        results.push({ studentId, success: false, message: error.message });
                    }
                }

                // Delete the uploaded file after processing
                fs.unlinkSync(filePath);

                res.json({ success: true, results });
            });
    } catch (error) {
        res.status(500).json({ success: false, message: "Bulk upload failed", error: error.message });
    }
});

// Delete student
router.delete("/student/:studentId", roleMiddleware("director"), async (req, res) => {
    try {
        const { studentId } = req.params;

        // Find and remove student from their room
        const room = await Room.findOne({ students: studentId });
        if (room) {
            room.students = room.students.filter(id => id.toString() !== studentId);
            // Update room status based on new occupancy
            if (room.students.length === 0) {
                room.status = "free";
            } else if (room.students.length < room.capacity) {
                room.status = "halfOccupied";
            }
            await room.save();
        }

        // Delete student's user record
        await User.findByIdAndDelete(studentId);

        res.json({ 
            success: true,
            message: "Student deleted successfully"
        });

    } catch (error) {
        console.error("[DELETE STUDENT ERROR]", error);
        res.status(500).json({ 
            success: false,
            message: "Failed to delete student",
            error: error.message 
        });
    }
});

module.exports = router;