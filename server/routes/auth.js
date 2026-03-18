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

        // Check if user exists
        const existingUser = await User.findOne({ pan: pan.toUpperCase() });
        if (existingUser) {
            return res.status(400).json({ error: 'An account with this PAN already exists.' });
        }

        // Generate password from DOB (format: DDMMYYYY)
        const dobParts = dob.split('-'); // [YYYY, MM, DD]
        if (dobParts.length !== 3) {
            return res.status(400).json({ error: 'Invalid Date of Birth format.' });
        }
        const generatedPassword = `${dobParts[2]}${dobParts[1]}${dobParts[0]}`;

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(generatedPassword, salt);

        // Save user to MongoDB
        const newUser = new User({
            pan: pan.toUpperCase(),
            name,
            email,
            phone,
            dob,
            passwordHash: hashedPassword,
            panCopy,
        });
        await newUser.save();

        res.status(201).json({ message: 'Account application received successfully.' });

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
            return res.status(400).json({ error: 'Username and password are required.' });
        }

        // Check for secure demo login
        if (process.env.DEMO_USERNAME && process.env.DEMO_PASSWORD && 
            username === process.env.DEMO_USERNAME && password === process.env.DEMO_PASSWORD) {
            
            const token = jwt.sign(
                { userId: 'demo-user', role: 'demo' },
                process.env.JWT_SECRET,
                { expiresIn: '1h' }
            );

            res.cookie('auth_token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 3600000
            });

            return res.json({
                message: 'Demo login successful',
                user: {
                    name: 'Demo Investor',
                    email: 'demo@liveinvestments.in',
                    pan: 'DEMOPAN123'
                }
            });
        }

        // Find user by PAN or Email
        const user = await User.findOne({
            $or: [
                { pan: username.toUpperCase() },
                { email: username }
            ]
        });

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        // Compare passwords
        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        // Generate JWT
        const token = jwt.sign(
            { userId: user._id.toString() },
            process.env.JWT_SECRET,
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

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Handle demo user session
        if (decoded.role === 'demo') {
            return res.json({
                user: {
                    name: 'Demo Investor',
                    email: 'demo@liveinvestments.in',
                    pan: 'DEMOPAN123'
                }
            });
        }

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
