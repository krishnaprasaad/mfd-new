import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import portfolioRoutes from './routes/portfolio.js';
import contactRoutes from './routes/contact.js';
import meetingRoutes from './routes/meeting.js';
import careersRoutes from './routes/careers.js';
import adminRoutes from './routes/admin.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDB } from './db.js';

dotenv.config();

export const app = express();

// CORS configuration
const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:8888',
    'https://liveinvestments.club'
];
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

// Connect to MongoDB before handling API requests (specifically for Vercel serverless)
app.use(async (req, res, next) => {
    // Only try to connect for API routes to save execution time on static files if any
    if (req.path.startsWith('/api')) {
        try {
            await connectDB();
        } catch (err) {
            console.error('❌ Database connection failed in middleware:', err);
            return res.status(500).json({ error: 'Database connection failed' });
        }
    }
    next();
});

// API routes
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Live Investments API is running' });
});
app.use('/api/auth', authRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/meeting', meetingRoutes);
app.use('/api/careers', careersRoutes);
app.use('/api/admin', adminRoutes);

// Serve static frontend in production
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
if (process.env.NODE_ENV === 'production') {
    const staticPath = path.join(__dirname, '../dist');
    app.use(express.static(staticPath));
    // Serve index.html for root
    app.get('/', (req, res) => {
        res.sendFile(path.join(staticPath, 'index.html'));
    });
    // Fallback for any other route (SPA handling)
    app.use((req, res) => {
        res.sendFile(path.join(staticPath, 'index.html'));
    });
}

// Local dev server only
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Live Investments server running on http://localhost:${PORT}`);
    });
}
