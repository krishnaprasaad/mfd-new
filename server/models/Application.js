import mongoose from 'mongoose';

const applicationSchema = new mongoose.Schema({
    salutation: {
        type: String,
        required: true,
        enum: ['Mr.', 'Ms.', 'Mrs.', 'Dr.']
    },
    fullName: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email address']
    },
    phone: {
        type: String,
        required: true,
        trim: true
    },
    position: {
        type: String,
        required: true,
        trim: true
    },
    location: {
        type: String,
        required: true,
        trim: true
    },
    resume: {
        type: String,
        required: true
    },
    portfolioLink: {
        type: String,
        trim: true
    },
    message: {
        type: String,
        required: true,
        trim: true
    },
    consent: {
        type: Boolean,
        required: true,
        validate: {
            validator: function(v) {
                return v === true;
            },
            message: 'You must provide consent for data collection.'
        }
    },
    status: {
        type: String,
        default: 'Pending',
        enum: ['Pending', 'Reviewed', 'Interviewing', 'Rejected', 'Hired']
    }
}, { timestamps: true });

export const Application = mongoose.model('Application', applicationSchema);
