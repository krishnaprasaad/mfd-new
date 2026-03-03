import express from 'express';
import { connectDB } from '../db.js';
import Contact from '../models/Contact.js';

const router = express.Router();

// POST /api/contact
router.post('/', async (req, res) => {
    try {
        await connectDB();
        const { name, email, phone, message } = req.body;

        if (!name || !email || !phone || !message) {
            return res.status(400).json({ error: 'All fields are required.' });
        }

        const contact = new Contact({ name, email, phone, message });
        await contact.save();

        res.status(201).json({ message: 'Thank you for reaching out! We will contact you soon.' });
    } catch (error) {
        console.error('Contact form error:', error);
        res.status(500).json({ error: 'Failed to submit. Please try again.' });
    }
});

export default router;
