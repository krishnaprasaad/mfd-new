import mongoose from 'mongoose';
import { attachDatabasePool } from '@vercel/functions';

let cached = global.mongoose;

if (!cached) {
    cached = global.mongoose = { conn: null, promise: null };
}

export async function connectDB() {
    if (cached.conn) return cached.conn;

    if (!process.env.MONGODB_URI) {
        throw new Error('MONGODB_URI environment variable is not set!');
    }

    if (!cached.promise) {
        console.log('🔌 Connecting to MongoDB...');
        cached.promise = mongoose.connect(process.env.MONGODB_URI, {
            bufferCommands: false,
            serverSelectionTimeoutMS: 10000,
        }).then(mongooseInstance => {
            try {
                const client = mongooseInstance.connection.getClient();
                attachDatabasePool(client);
                console.log('✅ Attached database pool to Vercel Functions middleware');
            } catch (poolErr) {
                console.warn('⚠️ Could not attach database pool (local environment?):', poolErr.message);
            }
            return mongooseInstance;
        }).catch((err) => {
            // Clear the cached promise on failure so the next request retries
            cached.promise = null;
            console.error('❌ MongoDB connection failed:', err.message);
            throw err;
        });
    }

    cached.conn = await cached.promise;
    console.log('✅ MongoDB connected');
    return cached.conn;
}
