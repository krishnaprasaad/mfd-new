import express from 'express';
import { Application } from '../models/Application.js';

const router = express.Router();

// Apply for a job
router.post('/apply', async (req, res) => {
    try {
        const { fullName, email, phone, position, portfolioLink, message } = req.body;

        // Basic validation
        if (!fullName || !email || !phone || !position || !message) {
            return res.status(400).json({ error: 'Please provide all required fields: fullName, email, phone, position, message' });
        }

        // Create new application
        const application = new Application({
            fullName,
            email,
            phone,
            position,
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
