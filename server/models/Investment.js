import mongoose from 'mongoose';

const investmentSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    fundId: { type: String, required: true },
    schemeCode: { type: String, trim: true },
    fundName: { type: String, required: true },
    category: { type: String, required: true },
    investedAmount: { type: Number, required: true },
    currentValue: { type: Number, required: true },
    returnsPercent: { type: Number, required: true },
    isExternal: { type: Boolean, default: false },
    source: { type: String, default: 'Direct' }, // 'Direct' or 'MF Central'
}, { timestamps: true });

const Investment = mongoose.models.Investment || mongoose.model('Investment', investmentSchema);

export default Investment;
