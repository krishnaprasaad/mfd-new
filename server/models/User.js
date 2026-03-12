import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    pan: { type: String, required: true, unique: true, uppercase: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String },
    dob: { type: String, required: true },
    passwordHash: { type: String, required: true },
    panCopy: { type: String }, // Path to the uploaded PAN card copy
}, { timestamps: true });

// Avoid model recompilation in serverless environments
const User = mongoose.models.User || mongoose.model('User', userSchema);

export default User;
