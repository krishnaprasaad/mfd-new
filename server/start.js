// Railway / production server entry point
// This runs the Express server permanently (not serverless)
import { app } from './index.js';
import { connectDB } from './db.js';

const PORT = process.env.PORT || 3000;

// Pre-connect to MongoDB at startup so first request is instant
connectDB()
    .then(() => {
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`✅ Live Wealth server running on port ${PORT}`);
        });
    })
    .catch((err) => {
        console.error('❌ Failed to connect to MongoDB:', err);
        process.exit(1);
    });
