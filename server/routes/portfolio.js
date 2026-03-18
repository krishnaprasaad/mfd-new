import express from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { connectDB } from '../db.js';
import User from '../models/User.js';
import Investment from '../models/Investment.js';

const router = express.Router();

// GET /api/portfolio
router.get('/', authMiddleware, async (req, res) => {
    try {
        await connectDB();
        const userId = req.userId;

        const user = await User.findById(userId).select('name email pan');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const investments = await Investment.find({ userId });

        let totalInvested = 0;
        let currentValue = 0;
        investments.forEach(inv => {
            totalInvested += inv.investedAmount;
            currentValue += inv.currentValue;
        });

        res.json({
            profile: {
                name: user.name,
                email: user.email,
                pan: user.pan
            },
            portfolio: {
                totalInvested,
                currentValue,
                investments: investments.map(inv => ({
                    id: inv._id.toString(),
                    fundId: inv.fundId,
                    name: inv.fundName,
                    category: inv.category,
                    investedAmount: inv.investedAmount,
                    currentValue: inv.currentValue,
                    returnsPercent: inv.returnsPercent
                }))
            }
        });

    } catch (error) {
        console.error('Fetch portfolio error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/portfolio/explore
router.get('/explore', async (req, res) => {
    const mockFundsList = [
        {
            id: "f-001",
            name: "Parag Parikh Flexi Cap Fund",
            category: "Flexi Cap",
            risk: "High",
            minSip: 1000,
            return1Yr: 38.5,
            return3Yr: 24.2,
            description: "Invests across large, mid, and small cap stocks dynamically, with added exposure to international equities for better diversification."
        },
        {
            id: "f-002",
            name: "HDFC Flexi Cap Fund",
            category: "Flexi Cap",
            risk: "High",
            minSip: 500,
            return1Yr: 41.2,
            return3Yr: 26.8,
            description: "A well-diversified equity fund that invests across market capitalizations to optimize risk-adjusted returns over the long term."
        }
    ];

    res.json(mockFundsList);
});

export default router;
