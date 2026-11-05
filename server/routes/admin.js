import express from 'express';
import jwt from 'jsonwebtoken';
import { Application } from '../models/Application.js';
import Contact from '../models/Contact.js';
import Meeting from '../models/Meeting.js';
import User from '../models/User.js';
import Investment from '../models/Investment.js';
import { getJwtSecret } from '../config/security.js';

const router = express.Router();

// Middleware to verify admin token
const adminAuth = (req, res, next) => {
    const token = req.cookies.admin_token;
    if (!token) {
        return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    try {
        const decoded = jwt.verify(token, getJwtSecret());
        if (decoded.role !== 'admin') {
            return res.status(403).json({ error: 'Forbidden: Admin access required' });
        }
        req.admin = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
};

// LOGIN
router.post('/login', (req, res) => {
    const adminUsername = process.env.ADMIN_USERNAME;
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminUsername || !adminPassword) {
        return res.status(503).json({ error: 'Admin login is not configured on this server.' });
    }
    const { username, password } = req.body;

    if (username === adminUsername && password === adminPassword) {
        const token = jwt.sign(
            { username, role: 'admin' },
            getJwtSecret(),
            { expiresIn: '2h' }
        );

        res.cookie('admin_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7200000 // 2 hours
        });

        return res.json({ message: 'Login successful' });
    }

    res.status(401).json({ error: 'Invalid admin credentials' });
});

// GET ALL DATA (Aggregated for Dashboard)
router.get('/data', adminAuth, async (req, res) => {
    try {
        const [applications, contacts, meetings, users, investments] = await Promise.all([
            Application.find().sort({ createdAt: -1 }),
            Contact.find().sort({ createdAt: -1 }),
            Meeting.find().sort({ createdAt: -1 }),
            User.find().sort({ createdAt: -1 }),
            Investment.find().sort({ createdAt: -1 })
        ]);

        res.json({
            cluster: 'atlas-erin-cloud',
            stats: {
                applications: applications.length,
                contacts: contacts.length,
                meetings: meetings.length,
                users: users.length,
                investments: investments.length
            },
            data: {
                applications,
                contacts,
                meetings,
                users,
                investments
            }
        });
    } catch (err) {
        console.error('Admin Data Error:', err);
        res.status(500).json({ error: 'Failed to fetch admin data' });
    }
});

// LOGOUT
router.post('/logout', (req, res) => {
    res.clearCookie('admin_token');
    res.json({ message: 'Logged out successfully' });
});

// GET Resume by Application ID
router.get('/resume/:id', adminAuth, async (req, res) => {
    try {
        const application = await Application.findById(req.params.id);
        if (!application) {
            return res.status(404).json({ error: 'Application not found' });
        }

        // If resume is stored as Base64/Buffer in DB (New method)
        if (application.resumeData) {
            const buffer = Buffer.from(application.resumeData, 'base64');
            res.setHeader('Content-Type', application.resumeMimeType || 'application/pdf');
            res.setHeader('Content-Disposition', `inline; filename="${application.resumeOriginalName || 'resume.pdf'}"`);
            return res.send(buffer);
        }

        // Fallback for old records using file paths (Legacy method)
        if (!application.resume) {
            return res.status(404).json({ error: 'Resume not found' });
        }

        res.sendFile(application.resume, (err) => {
            if (err) {
                console.error('Error sending file:', err);
                if (!res.headersSent) {
                    res.status(404).json({ error: 'File not found on server' });
                }
            }
        });
    } catch (err) {
        console.error('Error fetching resume:', err);
        res.status(500).json({ error: 'Failed to fetch resume' });
    }
});

export default router;
