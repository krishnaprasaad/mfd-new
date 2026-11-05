import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true, maxlength: 4000 },
    createdAt: { type: Date, default: Date.now }
}, { _id: false });

const conversationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    messages: { type: [messageSchema], default: [] }
}, { timestamps: true });

const CfoConversation = mongoose.models.CfoConversation ||
    mongoose.model('CfoConversation', conversationSchema);

export default CfoConversation;
