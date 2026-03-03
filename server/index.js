import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import portfolioRoutes from './routes/portfolio.js';
import contactRoutes from './routes/contact.js';
import meetingRoutes from './routes/meeting.js';

dotenv.config();

export const app = express();

// CORS
const allowedOrigins = ['http://localhost:5173', 'http://localhost:8888'];
app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(null, true); // same-origin requests in production
        }
    },
    credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// --- API Routes ---
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Live Wealth API is running' });
});
app.use('/api/auth', authRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/meeting', meetingRoutes);

// --- Local dev server only ---
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Live Wealth server running on http://localhost:${PORT}`);
    });
}
