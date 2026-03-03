import mongoose from 'mongoose';

const meetingSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    preferredTime: { type: String, trim: true }, // optional preferred time/date
    status: { type: String, default: 'pending' }, // pending / confirmed / done
}, { timestamps: true });

const Meeting = mongoose.models.Meeting || mongoose.model('Meeting', meetingSchema);

export default Meeting;
