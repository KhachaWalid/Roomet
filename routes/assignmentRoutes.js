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
const crypto = require("crypto"); // For token generation

const router = express.Router();

// Configure multer for file uploads
const upload = multer({ dest: "uploads/" });

// Configure nodemailer transporter (reuse from authRoutes if possible)
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

router.post("/add-student", roleMiddleware("director"), async (req, res) => {
    try {
        const { roomId, email, phone, studentId, firstName, lastName } = req.body;

        // Validate required fields
        if (!email || !phone || !studentId || !firstName || !lastName) {
            return res.status(400).json({ success: false, message: "All fields except roomId are required" });
        }

        // Check if the student already exists
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

        // Handle room assignment if roomId is provided
        if (roomId) {
            const room = await Room.findById(roomId);
            if (!room) {
                return res.status(404).json({ success: false, message: "Room not found" });
            }

            // Add student to the room if not already present
            if (!room.students.includes(student._id)) {
                room.students.push(student._id);
                room.status = room.students.length >= room.capacity ? "occupied" : "halfOccupied";
                await room.save();
            }

            // Assign the room to the student
            student.room = room._id;
        }

        // Save the student
        await student.save();

        // Generate activation token and send email if student is new or not activated
        if (!student.activationToken || student.isVerified === false) {
            const activationToken = crypto.randomBytes(20).toString('hex');
            student.activationToken = activationToken;
            student.activationExpire = Date.now() + 10 * 24 * 60 * 60 * 1000; // 10 days
            student.isVerified = false;
            await student.save();

            const activationUrl = `http://localhost:3000/activate/${activationToken}`;
            const mailOptions = {
                to: student.email,
                subject: 'Activate Your Roomet Student Account',
                html: `
                    <h1>Welcome to ROOMET!</h1>
                    <p>You have been assigned a room. Please activate your account by clicking the link below and set your password:</p>
                    <a href="${activationUrl}">Activate Account</a>
                    <p>This link will expire in 10 days.</p>
                `
            };
            await transporter.sendMail(mailOptions);
        }

        // Populate room and block details for the response
        await student.populate({
            path: "room",
            populate: { path: "block", select: "name" }
        });

        // Respond with the student details
        res.json({
            success: true,
            message: "Student added successfully",
            student: {
                ...student.toObject(),
                room: student.room?.name || null,
                block: student.room?.block?.name || null
            }
        });
    } catch (error) {
        console.error("[ADD STUDENT ERROR]", error);
        res.status(500).json({ success: false, message: "Failed to add student", error: error.message });
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
                studentId: student.studentId, // Ensure studentId is included
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

// Get a single student's detailed information
router.get("/student/:studentId", roleMiddleware("director"), async (req, res) => {
    try {
        const { studentId } = req.params;

        // Find the student by ID and populate related fields
        const student = await User.findById(studentId)
            .populate({
                path: "room",
                populate: {
                    path: "block",
                    select: "-__v" // Exclude the __v field from the block
                },
                select: "-__v" // Exclude the __v field from the room
            });

        if (!student) {
            return res.status(404).json({
                success: false,
                message: "Student not found"
            });
        }

        // Fetch maintenance reports related to the student
        const reports = await MaintenanceRequest.find({ student: student._id });

        res.json({
            success: true,
            student: {
                ...student.toObject(),
                studentId: student.studentId, // Ensure studentId is included
                room: student.room || null, // Include all room details
                block: student.room?.block || null, // Include all block details
                reports: {
                    count: reports.length,
                    details: reports
                }
            }
        });
    } catch (error) {
        console.error("[GET STUDENT ERROR]", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch student details",
            error: error.message
        });
    }
});

// Update student details (PATCH)
router.patch("/student/:studentId", roleMiddleware("director"), async (req, res) => {
    try {
        const { studentId } = req.params;
        // Allow patching all fields, including studentId
        const { firstName, lastName, email, phone, roomId, studentId: newStudentId } = req.body;
        const updateFields = { firstName, lastName, email, phone };
        if (newStudentId) updateFields.studentId = newStudentId;
        // Remove undefined fields
        Object.keys(updateFields).forEach(key => updateFields[key] === undefined && delete updateFields[key]);
        let student = await User.findByIdAndUpdate(studentId, updateFields, { new: true });
        if (!student) {
            return res.status(404).json({ success: false, message: "Student not found" });
        }
        // Handle room assignment if roomId is provided
        if (roomId) {
            const room = await Room.findById(roomId);
            if (!room) {
                return res.status(404).json({ success: false, message: "Room not found" });
            }
            // Remove student from previous room if assigned
            if (student.room && student.room.toString() !== roomId) {
                const prevRoom = await Room.findById(student.room);
                if (prevRoom) {
                    prevRoom.students = prevRoom.students.filter(id => id.toString() !== student._id.toString());
                    prevRoom.status = prevRoom.students.length === 0 ? "free" : (prevRoom.students.length < prevRoom.capacity ? "halfOccupied" : "occupied");
                    await prevRoom.save();
                }
            }
            // Add student to new room if not already present
            if (!room.students.includes(student._id)) {
                room.students.push(student._id);
                room.status = room.students.length >= room.capacity ? "occupied" : "halfOccupied";
                await room.save();
            }
            student.room = room._id;
            await student.save();
        }
        await student.populate({ path: "room", populate: { path: "block", select: "name" } });
        res.json({ success: true, message: "Student updated successfully", student: { ...student.toObject(), studentId: student.studentId, room: student.room?.name || null, block: student.room?.block?.name || null } });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to update student", error: error.message });
    }
});

// Delete student (improved)
router.delete("/student/:studentId", roleMiddleware("director"), async (req, res) => {
    try {
        const { studentId } = req.params;
        // Remove student from all rooms
        const rooms = await Room.find({ students: studentId });
        for (const room of rooms) {
            room.students = room.students.filter(id => id.toString() !== studentId);
            room.status = room.students.length === 0 ? "free" : (room.students.length < room.capacity ? "halfOccupied" : "occupied");
            await room.save();
        }
        // Delete student's user record
        const deleted = await User.findByIdAndDelete(studentId);
        if (!deleted) {
            return res.status(404).json({ success: false, message: "Student not found" });
        }
        res.json({ success: true, message: "Student deleted successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to delete student", error: error.message });
    }
});

// Student account activation route
router.post("/activate/:token", async (req, res) => {
    try {
        const { token } = req.params;
        const { password } = req.body;
        if (!password || password.length < 6) {
            return res.status(400).json({ success: false, message: "Password must be at least 6 characters." });
        }
        const student = await User.findOne({ activationToken: token, activationExpire: { $gt: Date.now() }, role: "student" });
        if (!student) {
            return res.status(400).json({ success: false, message: "Invalid or expired activation token." });
        }
        student.password = password;
        student.isVerified = true;
        student.activationToken = undefined;
        student.activationExpire = undefined;
        await student.save();
        res.json({ success: true, message: "Account activated. You can now log in." });
    } catch (error) {
        res.status(500).json({ success: false, message: "Activation failed", error: error.message });
    }
});


module.exports = router;