import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load .env
dotenv.config();

const uri = process.env.MONGODB_URI;

if (!uri) {
    console.error('MONGODB_URI not found in .env');
    process.exit(1);
}

console.log('🔌 Testing connection to MongoDB (from .env)...');
const maskedUri = uri.replace(/:([^:@]+)@/, ':****@');
console.log('URI:', maskedUri);

async function testConnection() {
    try {
        await mongoose.connect(uri, {
            serverSelectionTimeoutMS: 5000,
        });
        console.log('✅ Connection successful!');
        
        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log('Available collections:', collections.map(c => c.name));
        
        if (collections.length === 0) {
            console.warn('⚠️ No collections found. The database is empty.');
        }

        await mongoose.disconnect();
        process.exit(0);
    } catch (err) {
        console.error('❌ Connection failed:');
        console.error(err);
        process.exit(1);
    }
}

testConnection();
