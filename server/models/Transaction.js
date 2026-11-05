import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    investmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Investment', required: true, index: true },
    fundName: { type: String, required: true, trim: true },
    type: {
        type: String,
        enum: ['purchase', 'sip', 'redemption', 'dividend'],
        required: true
    },
    amount: { type: Number, required: true, min: 0 },
    units: { type: Number, min: 0 },
    nav: { type: Number, min: 0 },
    date: { type: Date, required: true },
    source: { type: String, required: true, trim: true }
}, { timestamps: true });

transactionSchema.index({ userId: 1, investmentId: 1, date: 1 });

const Transaction = mongoose.models.Transaction || mongoose.model('Transaction', transactionSchema);

export default Transaction;
