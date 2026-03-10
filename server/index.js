import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import portfolioRoutes from './routes/portfolio.js';
import contactRoutes from './routes/contact.js';
import meetingRoutes from './routes/meeting.js';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

export const app = express();

// CORS configuration
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

// API routes
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Live Wealth API is running' });
});
app.use('/api/auth', authRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/meeting', meetingRoutes);

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
        console.log(`Live Wealth server running on http://localhost:${PORT}`);
    });
}
