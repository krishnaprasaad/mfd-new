import express from 'express';
import { connectDB } from '../db.js';
import Meeting from '../models/Meeting.js';

const router = express.Router();

// POST /api/meeting
router.post('/', async (req, res) => {
    try {
        await connectDB();
        const { serviceType, name, email, phone, preferredTime } = req.body;

        if (!serviceType || !name || !email || !phone) {
            return res.status(400).json({ error: 'Service type, name, email and phone are required.' });
        }

        const meeting = new Meeting({ serviceType, name, email, phone, preferredTime });
        await meeting.save();

        res.status(201).json({ message: 'Appointment booked! Our team will contact you shortly to confirm.' });
    } catch (error) {
        console.error('Appointment booking error:', error);
        res.status(500).json({ error: 'Failed to book appointment. Please try again.' });
    }
});

export default router;
