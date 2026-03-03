import mongoose from 'mongoose';

const meetingSchema = new mongoose.Schema({
    serviceType: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    preferredTime: { type: String, trim: true },
    status: { type: String, default: 'pending' },
}, { timestamps: true });

const Meeting = mongoose.models.Meeting || mongoose.model('Meeting', meetingSchema);

export default Meeting;
