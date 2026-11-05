import mongoose from 'mongoose';

const portfolioValuationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    investmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Investment', required: true },
    fundName: { type: String, required: true },
    schemeCode: { type: String, trim: true },
    investedAmount: { type: Number, required: true, min: 0 },
    currentValue: { type: Number, required: true, min: 0 },
    asOfDate: { type: Date, required: true },
    source: { type: String, required: true }
}, { timestamps: true });

portfolioValuationSchema.index({ userId: 1, asOfDate: -1, investmentId: 1 }, { unique: true });

const PortfolioValuation = mongoose.models.PortfolioValuation ||
    mongoose.model('PortfolioValuation', portfolioValuationSchema);

export default PortfolioValuation;
