import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import os from 'os';
import { Application } from '../models/Application.js';

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
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

const router = express.Router();

// Apply for a job
router.post('/apply', upload.single('resume'), async (req, res) => {
    try {
        const { fullName, email, phone, position, location, portfolioLink, message } = req.body;
        const resume = req.file ? req.file.path : null;

        // Basic validation
        if (!fullName || !email || !phone || !position || !location || !message || !resume) {
            return res.status(400).json({ error: 'Please provide all required fields, including your resume.' });
        }

        // Create new application
        const application = new Application({
            fullName,
            email,
            phone,
            position,
            location,
            resume,
            portfolioLink,
            message
        });


        await application.save();

        res.status(201).json({ success: true, message: 'Application submitted successfully. We will be in touch!' });
    } catch (err) {
        console.error('Error submitting application:', err);
        
        // Handle Mongoose validation errors
        if (err.name === 'ValidationError') {
            const messages = Object.values(err.errors).map(val => val.message);
            return res.status(400).json({ error: messages.join(', ') });
        }

        res.status(500).json({ error: 'Server error while submitting application' });
    }
});

// Admin route to get all applications (could be protected later)
router.get('/', async (req, res) => {
    try {
        const applications = await Application.find().sort({ createdAt: -1 });
        res.json(applications);
    } catch (err) {
        console.error('Error fetching applications:', err);
        res.status(500).json({ error: 'Server error while fetching applications' });
    }
});

export default router;
