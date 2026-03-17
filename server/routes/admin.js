import express from 'express';
import jwt from 'jsonwebtoken';
import { Application } from '../models/Application.js';
import Contact from '../models/Contact.js';
import Meeting from '../models/Meeting.js';
import User from '../models/User.js';
import Investment from '../models/Investment.js';

const router = express.Router();

// Middleware to verify admin token
const adminAuth = (req, res, next) => {
    const token = req.cookies.admin_token;
    if (!token) {
        return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
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
    const { username, password } = req.body;

    if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
        const token = jwt.sign(
            { username, role: 'admin' },
            process.env.JWT_SECRET,
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

export default router;
