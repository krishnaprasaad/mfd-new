import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { connectDB } from '../db.js';
import User from '../models/User.js';
import multer from 'multer';
import path from 'path';

import fs from 'fs';
import { fileURLToPath } from 'url';
import os from 'os';
import { getJwtSecret } from '../config/security.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure uploads directory exists. Uses /tmp in production (Vercel) since it's the only writable dir
const isProduction = process.env.NODE_ENV === 'production';
const uploadDir = isProduction ? path.join(os.tmpdir(), 'uploads') : path.join(__dirname, '../uploads');

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

const router = express.Router();

// SIGNUP
router.post('/signup', upload.single('panCopy'), async (req, res) => {
    try {
        await connectDB();
        const { pan, name, email, phone, dob } = req.body;
        const panCopy = req.file ? req.file.path : null;

        if (!pan || !name || !email || !phone || !dob) {
            return res.status(400).json({ error: 'All fields are required.' });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const normalizedPan = pan.trim().toUpperCase();

        // Check if user exists by PAN or Email
        const existingUser = await User.findOne({
            $or: [
                { email: normalizedEmail },
                { pan: normalizedPan }
            ]
        });

        if (existingUser) {
            if (existingUser.email && existingUser.email.toLowerCase() === normalizedEmail) {
                return res.status(400).json({ error: 'An account with this email address already exists. Please log in.' });
            }
            return res.status(400).json({ error: 'An account with this PAN already exists. Please log in.' });
        }

        // Generate password from DOB (format: DDMMYYYY, e.g. 23 Jun 2003 -> 23062003)
        const dobClean = dob.trim();
        let generatedPassword = '';
        if (/^\d{4}[-/]\d{2}[-/]\d{2}$/.test(dobClean)) {
            const parts = dobClean.split(/[-/]/); // [YYYY, MM, DD]
            generatedPassword = `${parts[2]}${parts[1]}${parts[0]}`;
        } else if (/^\d{2}[-/]\d{2}[-/]\d{4}$/.test(dobClean)) {
            const parts = dobClean.split(/[-/]/); // [DD, MM, YYYY]
            generatedPassword = `${parts[0]}${parts[1]}${parts[2]}`;
        } else if (/^\d{8}$/.test(dobClean)) {
            generatedPassword = dobClean;
        } else {
            return res.status(400).json({ error: 'Invalid Date of Birth format. Please select a valid date.' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(generatedPassword, salt);

        // Save user to MongoDB
        const newUser = new User({
            pan: normalizedPan,
            name: name.trim(),
            email: normalizedEmail,
            phone: phone.trim(),
            dob: dobClean,
            passwordHash: hashedPassword,
            panCopy,
        });
        await newUser.save();

        res.status(201).json({
            message: 'Account created successfully!',
            username: normalizedEmail,
            password: generatedPassword,
            user: {
                name: newUser.name,
                email: newUser.email,
                pan: newUser.pan
            }
        });

    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// LOGIN
router.post('/login', async (req, res) => {
    try {
        await connectDB();
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username (email or PAN) and password are required.' });
        }

        const cleanInput = username.trim();
        const cleanPassword = password.trim();

        // Find user by PAN or Email (case-insensitive)
        const user = await User.findOne({
            $or: [
                { email: cleanInput.toLowerCase() },
                { pan: cleanInput.toUpperCase() },
                { email: { $regex: new RegExp(`^${cleanInput.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } }
            ]
        });

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials. Please check your username (email) and password (DOB: DDMMYYYY).' });
        }

        // Compare passwords
        const isMatch = await bcrypt.compare(cleanPassword, user.passwordHash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials. Password is your Date of Birth in DDMMYYYY format (e.g., 23062003).' });
        }

        // Generate JWT
        const token = jwt.sign(
            { userId: user._id.toString() },
            getJwtSecret(),
            { expiresIn: '1h' }
        );

        // Set JWT in HTTP-only cookie
        res.cookie('auth_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 3600000
        });

        res.json({
            message: 'Login successful',
            user: {
                id: user._id.toString(),
                name: user.name,
                email: user.email,
                pan: user.pan
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// LOGOUT
router.post('/logout', (req, res) => {
    res.clearCookie('auth_token');
    res.json({ message: 'Logged out successfully' });
});

// VERIFY SESSION
router.get('/me', async (req, res) => {
    try {
        const token = req.cookies.auth_token;
        if (!token) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const decoded = jwt.verify(token, getJwtSecret());

        await connectDB();
        const user = await User.findById(decoded.userId).select('name email pan');

        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }

        res.json({ user });
    } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
    }
});

export default router;
