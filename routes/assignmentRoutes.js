const express = require("express");
const Room = require("../models/Room");
const User = require("../models/User");
const roleMiddleware = require("../middleware/roleMiddleware");
const nodemailer = require("nodemailer"); // Add nodemailer for email functionality
const multer = require("multer"); // Add multer for file uploads
const csvParser = require("csv-parser"); // Add csv-parser for processing CSV files
const fs = require("fs");
const xlsx = require("xlsx"); // Add xlsx for Excel file processing
const MaintenanceRequest = require("../models/MaintenanceRequest");

const router = express.Router();

// Configure multer for file uploads
const upload = multer({ dest: "uploads/" });

router.post("/add-student", roleMiddleware("director"), async (req, res) => {
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
        await student.populate("room", "name block");

        // If the student is not assigned to a room, set room and block to null
        const roomName = student.room ? student.room.name : null;
        const blockName = student.room?.block ? student.room.block.name : null;

        res.json({ 
            success: true,
            message: `Student ${roomId ? "assigned to room and" : "added without room assignment and"} email sent`,
            student: {
                ...student.toObject(),
                room: roomName,
                block: blockName
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

router.post("/bulk", roleMiddleware("director"), upload.single("file"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: "No file uploaded" });
        }

        const filePath = req.file.path;
        const students = [];

        const validateStudent = (student) => {
            const requiredFields = ['email', 'phone', 'studentId', 'firstName', 'lastName'];
            const missingFields = requiredFields.filter(field => !student[field]);

            if (missingFields.length > 0) {
                return {
                    isValid: false,
                    message: `Missing required fields: ${missingFields.join(', ')}`
                };
            }

            if (!/^\S+@\S+\.\S+$/.test(student.email)) {
                return { isValid: false, message: "Invalid email format" };
            }

            return { isValid: true };
        };

        // CSV
        if (req.file.mimetype === "text/csv" || req.file.originalname.endsWith(".csv")) {
            await new Promise((resolve, reject) => {
                fs.createReadStream(filePath)
                    .pipe(csvParser())
                    .on("data", (row) => {
                        const trimmedRow = {};
                        Object.keys(row).forEach(key => {
                            trimmedRow[key.trim()] = typeof row[key] === 'string' ? row[key].trim() : row[key];
                        });
                        students.push(trimmedRow);
                    })
                    .on("end", resolve)
                    .on("error", reject);
            });
        }
        // Excel
        else if (
            req.file.mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || 
            req.file.originalname.match(/\.xlsx?$/i)
        ) {
            const workbook = xlsx.readFile(filePath);
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = xlsx.utils.sheet_to_json(firstSheet);

            students.push(...jsonData.map(row => {
                const trimmedRow = {};
                Object.keys(row).forEach(key => {
                    trimmedRow[key.trim()] = typeof row[key] === 'string' ? row[key].trim() : row[key];
                });
                return trimmedRow;
            }));
        } else {
            fs.unlinkSync(filePath);
            return res.status(400).json({ 
                success: false, 
                message: "Unsupported file format. Please upload a CSV or Excel file." 
            });
        }

        const results = [];
        for (const studentData of students) {
            const { email, phone, studentId, firstName, lastName, roomId } = studentData;
            const result = { studentId, success: false };

            const validation = validateStudent(studentData);
            if (!validation.isValid) {
                result.message = validation.message;
                result.student = studentData;
                results.push(result);
                continue;
            }

            try {
                let student = await User.findOne({ studentId });

                if (!roomId) {
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
                    result.success = true;
                    result.message = "Student added/updated without room assignment";
                    result.student = {
                        ...student.toObject(),
                        room: student.room?.name || null,
                        block: student.room?.block?.name || null
                    };
                    results.push(result);
                    continue;
                }

                const room = await Room.findById(roomId);
                if (!room) {
                    result.message = "Room not found";
                    result.student = studentData;
                    results.push(result);
                    continue;
                }

                if (!student) {
                    student = new User({
                        firstName,
                        lastName,
                        phone,
                        email,
                        studentId,
                        role: "student",
                        room: room._id
                    });
                } else {
                    student.room = room._id;
                }

                if (!room.students.includes(student._id)) {
                    room.students.push(student._id);
                    room.status = room.students.length >= room.capacity ? "full" : "halfOccupied";
                    await room.save();
                }

                await student.save();
                await student.populate("room", "name block");

                result.success = true;
                result.message = "Student added/updated successfully";
                result.student = {
                    ...student.toObject(),
                    room: student.room?.name || null,
                    block: student.room?.block?.name || null
                };
                results.push(result);
            } catch (error) {
                result.message = error.message;
                result.student = studentData;
                results.push(result);
            }
        }

        fs.unlinkSync(filePath);
        res.json({ 
            success: true, 
            processed: results.length,
            results 
        });

    } catch (error) {
        if (req.file?.path) fs.unlinkSync(req.file.path);
        console.error("[BULK UPLOAD ERROR]", error);
        res.status(500).json({ 
            success: false, 
            message: "Bulk upload failed", 
            error: error.message 
        });
    }
});

router.get("/students", roleMiddleware("director"), async (req, res) => {
    try {
        const students = await User.find({ role: "student" })
            .populate({
                path: "room",
                populate: {
                    path: "block",
                    select: "name"
                },
                select: "name block"
            });

        const studentsWithReports = await Promise.all(students.map(async (student) => {
            const reportCount = await MaintenanceRequest.countDocuments({ student: student._id });
            return {
                ...student.toObject(),
                room: student.room?.name || null,
                block: student.room?.block?.name || null,
                reports: reportCount
            };
        }));

        res.json({
            success: true,
            students: studentsWithReports
        });
    } catch (error) {
        console.error("[GET STUDENTS ERROR]", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch students",
            error: error.message
        });
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