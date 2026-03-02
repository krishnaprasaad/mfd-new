import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import portfolioRoutes from './routes/portfolio.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
    origin: 'http://localhost:5173', // Vite default port
    credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Basic health check route
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Live Wealth API is running' });
});

app.use('/api/auth', authRoutes);
app.use('/api/portfolio', portfolioRoutes);

app.listen(PORT, () => {
    console.log(`Backend Server running on http://localhost:${PORT}`);
});
