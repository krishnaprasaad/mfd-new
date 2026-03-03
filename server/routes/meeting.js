import express from 'express';
import { connectDB } from '../db.js';
import Meeting from '../models/Meeting.js';

const router = express.Router();

// POST /api/meeting
router.post('/', async (req, res) => {
    try {
        await connectDB();
        const { name, email, phone, preferredTime } = req.body;

        if (!name || !email || !phone) {
            return res.status(400).json({ error: 'Name, email and phone number are required.' });
        }

        const meeting = new Meeting({ name, email, phone, preferredTime });
        await meeting.save();

        res.status(201).json({ message: 'Thank you! Our VP will contact you shortly to confirm your meeting.' });
    } catch (error) {
        console.error('Meeting booking error:', error);
        res.status(500).json({ error: 'Failed to book meeting. Please try again.' });
    }
});

export default router;
