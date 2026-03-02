import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/portfolio
// Fetch portfolio summary and investments for the logged-in user
router.get('/', authMiddleware, async (req, res) => {
    try {
        const userId = req.userId;

        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                investments: true
            }
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Calculate totals
        let totalInvested = 0;
        let currentValue = 0;

        user.investments.forEach(inv => {
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
                investments: user.investments.map(inv => ({
                    id: inv.id,
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
// Mock endpoint to fetch explore funds (in a real app this would query a master funds table)
router.get('/explore', async (req, res) => {
    // Reusing the static list for simplicity as these aren't user-specific
    const mockFundsList = [
        {
            id: "f-001",
            name: "Live Wealth Future Tech Fund",
            category: "Thematic - Tech",
            risk: "High",
            minSip: 1000,
            return1Yr: 42.5,
            return3Yr: 28.4,
            description: "Invests in high-growth technology companies focused on AI, robotics, and cloud computing globally."
        },
        {
            id: "f-002",
            name: "Live Wealth Core Equity Advantage",
            category: "Large Cap",
            risk: "Moderate",
            minSip: 500,
            return1Yr: 21.2,
            return3Yr: 15.8,
            description: "A stable foundation for your portfolio, investing in top 100 blue-chip companies with proven track records."
        },
        {
            id: "f-003",
            name: "Live Wealth Green Energy Focus",
            category: "Sectoral - ESG",
            risk: "High",
            minSip: 1000,
            return1Yr: 35.8,
            return3Yr: 22.1,
            description: "Capitalizes on the global transition to renewable energy and sustainable business practices."
        },
        {
            id: "f-004",
            name: "Live Wealth Dynamic Bond Fund",
            category: "Debt - Dynamic",
            risk: "Low",
            minSip: 5000,
            return1Yr: 8.5,
            return3Yr: 7.2,
            description: "Actively managed debt portfolio adjusting duration based on interest rate outlook for consistent returns."
        },
        {
            id: "f-005",
            name: "Live Wealth Midcap Outperform",
            category: "Mid Cap",
            risk: "High",
            minSip: 1000,
            return1Yr: 48.3,
            return3Yr: 26.5,
            description: "Targets tomorrow's leaders by investing in fast-growing mid-sized companies with strong scalability."
        },
        {
            id: "f-006",
            name: "Live Wealth Balanced Advantage",
            category: "Hybrid",
            risk: "Moderate",
            minSip: 1000,
            return1Yr: 18.5,
            return3Yr: 14.1,
            description: "Automatically balances between equity and debt based on market valuations to optimize risk-adjusted returns."
        }
    ];

    res.json(mockFundsList);
});

export default router;
