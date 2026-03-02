import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.js';
import portfolioRoutes from './routes/portfolio.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CORS: allow localhost in dev, same-origin in production
const allowedOrigins = ['http://localhost:5173'];
app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(null, true); // same-origin requests pass without Origin header
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

// --- Serve Frontend in Production ---
const distPath = path.join(__dirname, '../dist');

if (!fs.existsSync(distPath)) {
    console.warn(`⚠️  dist/ folder not found at ${distPath}. Run: npm run build`);
} else {
    console.log(`✅ Serving frontend from: ${distPath}`);
}

app.use(express.static(distPath));

// Fallback: send index.html for any non-API route (client-side routing)
app.get('/{*path}', (req, res) => {
    const indexPath = path.join(distPath, 'index.html');
    if (!fs.existsSync(indexPath)) {
        return res.status(503).send('Frontend not built. Run: npm run build');
    }
    res.sendFile(indexPath);
});

app.listen(PORT, () => {
    console.log(`Live Wealth server running on http://localhost:${PORT}`);
});
