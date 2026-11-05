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

        const user = await User.findById(userId).select('name email pan phone');
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
                pan: user.pan,
                phone: user.phone || ''
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
                    returnsPercent: inv.returnsPercent,
                    isExternal: inv.isExternal || false,
                    source: inv.source || 'Direct'
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
        },
        {
            id: "f-003",
            name: "Mirae Asset Large Cap Fund",
            category: "Large Cap",
            risk: "Moderate",
            minSip: 1000,
            return1Yr: 29.4,
            return3Yr: 18.6,
            description: "Focuses on established bluechip companies with proven track records and steady compounding."
        },
        {
            id: "f-004",
            name: "Nippon India Small Cap Fund",
            category: "Small Cap",
            risk: "Very High",
            minSip: 500,
            return1Yr: 46.8,
            return3Yr: 31.5,
            description: "Aggressive growth potential investing in high-quality emerging small-cap market leaders."
        },
        {
            id: "f-005",
            name: "SBI Bluechip Fund",
            category: "Large Cap",
            risk: "Moderate",
            minSip: 500,
            return1Yr: 27.2,
            return3Yr: 17.4,
            description: "Consistent long-term wealth creation by investing in sector-leading established corporations."
        },
        {
            id: "f-006",
            name: "ICICI Prudential Technology Fund",
            category: "Sectoral / Tech",
            risk: "Very High",
            minSip: 1000,
            return1Yr: 44.1,
            return3Yr: 28.9,
            description: "High alpha thematic fund positioned for the global surge in AI, cloud, and digital transformation."
        }
    ];

    res.json(mockFundsList);
});

// POST /api/portfolio/invest
router.post('/invest', authMiddleware, async (req, res) => {
    try {
        await connectDB();
        const userId = req.userId;
        const { fundId, fundName, category, amount, returnsPercent } = req.body;

        const numAmount = Number(amount);
        if (!fundName || isNaN(numAmount) || numAmount <= 0) {
            return res.status(400).json({ error: 'Valid fund name and investment amount are required.' });
        }

        // Check if an existing investment exists for this user in this fund
        let investment = await Investment.findOne({
            userId,
            $or: [
                { fundId: fundId || 'custom' },
                { fundName: fundName.trim() }
            ]
        });

        const estReturnPercent = typeof returnsPercent === 'number' ? returnsPercent : 0;

        if (investment) {
            investment.investedAmount += numAmount;
            investment.currentValue += numAmount;
            await investment.save();
        } else {
            investment = new Investment({
                userId,
                fundId: fundId || `f-${Date.now()}`,
                fundName: fundName.trim(),
                category: category || 'Mutual Fund',
                investedAmount: numAmount,
                currentValue: numAmount,
                returnsPercent: estReturnPercent
            });
            await investment.save();
        }

        res.status(201).json({
            message: 'Investment recorded successfully!',
            investment
        });
    } catch (error) {
        console.error('Save investment error:', error);
        res.status(500).json({ error: 'Failed to record investment.' });
    }
});

// POST /api/portfolio/import-external - Import mutual funds from MF Central / CAS
router.post('/import-external', authMiddleware, async (req, res) => {
    try {
        await connectDB();
        const userId = req.userId;
        const { funds } = req.body;

        if (!Array.isArray(funds) || funds.length === 0) {
            return res.status(400).json({ error: 'No funds provided for import.' });
        }

        const imported = [];
        for (const item of funds) {
            const fundName = (item.fundName || item.name || '').trim();
            const category = item.category || 'Equity';
            const investedAmount = Number(item.investedAmount || item.amount) || 10000;
            const currentValue = Number(item.currentValue) || Math.round(investedAmount * 1.18);
            const returnsPercent = investedAmount > 0 ? Number((((currentValue - investedAmount) / investedAmount) * 100).toFixed(2)) : 0;

            if (!fundName) continue;

            let investment = await Investment.findOne({ userId, fundName });
            if (investment) {
                investment.investedAmount = investedAmount;
                investment.currentValue = currentValue;
                investment.returnsPercent = returnsPercent;
                investment.isExternal = true;
                investment.source = 'MF Central';
                await investment.save();
                imported.push(investment);
            } else {
                investment = new Investment({
                    userId,
                    fundId: item.fundId || `mfc-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                    fundName,
                    category,
                    investedAmount,
                    currentValue,
                    returnsPercent,
                    isExternal: true,
                    source: 'MF Central'
                });
                await investment.save();
                imported.push(investment);
            }
        }

        res.status(201).json({
            message: `Successfully imported ${imported.length} external mutual funds via MF Central.`,
            importedCount: imported.length
        });
    } catch (error) {
        console.error('Import external error:', error);
        res.status(500).json({ error: 'Failed to import external mutual funds.' });
    }
});

// GET /api/portfolio/ai-analysis - AI CFO deep diagnostic of internal & external mutual funds
router.get('/ai-analysis', authMiddleware, async (req, res) => {
    try {
        await connectDB();
        const userId = req.userId;
        const investments = await Investment.find({ userId });

        if (!investments || investments.length === 0) {
            return res.json({
                hasHoldings: false,
                message: 'No investment holdings found yet. Invest in a fund or sync your portfolio via MF Central to generate your comprehensive AI CFO report!'
            });
        }

        let totalInvested = 0;
        let currentValue = 0;
        const categoryMap = {};

        investments.forEach(inv => {
            totalInvested += inv.investedAmount;
            currentValue += inv.currentValue;
            const cat = inv.category || 'Equity';
            categoryMap[cat] = (categoryMap[cat] || 0) + inv.currentValue;
        });

        const overallGain = currentValue - totalInvested;
        const overallReturnPercent = totalInvested > 0 ? Number(((overallGain / totalInvested) * 100).toFixed(2)) : 0;

        // Category breakdown percentages
        const allocation = Object.keys(categoryMap).map(cat => ({
            category: cat,
            amount: categoryMap[cat],
            percentage: Number(((categoryMap[cat] / (currentValue || 1)) * 100).toFixed(1))
        }));

        // Scheme-by-scheme pros & cons generator based on fund characteristics
        const fundReviews = investments.map(inv => {
            const name = inv.fundName;
            const cat = inv.category || 'Equity';
            const weight = Number(((inv.currentValue / (currentValue || 1)) * 100).toFixed(1));

            const pros = [];
            const cons = [];

            if (cat.toLowerCase().includes('flexi') || name.toLowerCase().includes('flexi')) {
                pros.push('Dynamic multi-cap flexibility adapts efficiently across shifting economic cycles.');
                pros.push('High active share with proven risk-adjusted Sharpe ratio across 5-year periods.');
                cons.push('High concentration in top 5 banking & financial stocks creates sector vulnerability.');
                cons.push('Substantial overlap with broad market indices during strong bull runs.');
            } else if (cat.toLowerCase().includes('large') || name.toLowerCase().includes('bluechip') || name.toLowerCase().includes('large')) {
                pros.push('Institutional-grade liquidity and low beta offer robust downside capital protection.');
                pros.push('Resilient earnings quality and consistent dividend generation by market leaders.');
                cons.push('Alpha generation over benchmark (Nifty 50 TRI) is structurally constrained.');
                cons.push('Elevated valuations when market P/E reaches historical highs.');
            } else if (cat.toLowerCase().includes('small') || name.toLowerCase().includes('small')) {
                pros.push('Superior potential for multibagger returns through under-researched market leaders.');
                pros.push('High upside capture ratio during broad economic expansion phases.');
                cons.push('Significantly higher drawdown volatility; sensitive to sudden liquidity dry-ups.');
                cons.push('Strictly requires a minimum 5-7 year investment horizon.');
            } else if (cat.toLowerCase().includes('mid') || name.toLowerCase().includes('mid')) {
                pros.push('Sweet spot combining emerging market share with established corporate governance.');
                pros.push('Strong beneficiary of domestic manufacturing and capex revival.');
                cons.push('Valuation reratings can reverse sharply during monetary tightening.');
            } else if (cat.toLowerCase().includes('tech') || cat.toLowerCase().includes('sector')) {
                pros.push('Direct structural play on global AI modernization, enterprise cloud, and software.');
                pros.push('Natural currency hedge due to dollar-denominated export revenues.');
                cons.push('Sector concentration risk: vulnerable to slowdowns in US/European IT client budgets.');
            } else if (cat.toLowerCase().includes('balanced') || cat.toLowerCase().includes('hybrid')) {
                pros.push('Disciplined counter-cyclical asset allocation removes behavioral bias.');
                pros.push('Cushions portfolio volatility with lower downside risk and regular yields.');
                cons.push('Underperforms pure equity during powerful multi-year bull runs.');
            } else {
                pros.push('Provides liquidity diversification and steady compounding.');
                pros.push('Strict mandate adherence with systematic rebalancing.');
                cons.push('Monitor tracking error and total expense ratio (TER) annually.');
            }

            if (weight > 35) {
                cons.push(`Elevated single-fund exposure (${weight}% of total net asset value).`);
            }

            return {
                id: inv._id.toString(),
                fundName: inv.fundName,
                category: cat,
                investedAmount: inv.investedAmount,
                currentValue: inv.currentValue,
                returnsPercent: inv.returnsPercent,
                portfolioWeight: weight,
                source: inv.source || 'Direct',
                isExternal: inv.isExternal || false,
                pros,
                cons
            };
        });

        // Calculate overall Health Score (out of 100)
        let healthScore = 74;
        if (investments.length >= 3 && investments.length <= 6) healthScore += 10;
        else if (investments.length > 7) healthScore -= 4;
        if (overallReturnPercent > 12) healthScore += 10;
        if (allocation.some(a => a.percentage > 45)) healthScore -= 6;
        healthScore = Math.min(Math.max(healthScore, 55), 95);

        // Personal Recommendations from the AI CFO
        const recommendations = [];

        // Check for over-diversification
        if (investments.length > 6) {
            recommendations.push({
                type: 'Consolidation',
                icon: '✂️',
                title: 'Consolidate Redundant Schemes',
                description: `You currently hold ${investments.length} mutual funds. Holding more than 5-6 schemes dilutes alpha without meaningful risk reduction. Consider pruning weaker funds.`
            });
        }

        // Check for single fund concentration
        const topHolding = fundReviews.reduce((max, f) => f.portfolioWeight > max.portfolioWeight ? f : max, fundReviews[0]);
        if (topHolding && topHolding.portfolioWeight > 35) {
            recommendations.push({
                type: 'Rebalancing',
                icon: '⚖️',
                title: `Gradually Trim Exposure to ${topHolding.fundName}`,
                description: `${topHolding.fundName} represents ${topHolding.portfolioWeight}% of your total portfolio. A single scheme drawdown would disproportionately drag returns. Trim down towards a 20-25% cap.`
            });
        }

        // Check for hybrid/debt hedge
        const hasDebtOrHybrid = allocation.some(a => a.category.toLowerCase().includes('hybrid') || a.category.toLowerCase().includes('balanced') || a.category.toLowerCase().includes('debt'));
        if (!hasDebtOrHybrid && totalInvested >= 20000) {
            recommendations.push({
                type: 'Downside Defense',
                icon: '🛡️',
                title: 'Add a 15% Volatility Hedge',
                description: 'Your portfolio is 100% equity-exposed. Adding an allocation to a Dynamic Asset Allocation Fund or Multi-Asset scheme will protect capital during sharp market corrections.'
            });
        }

        // Check for overlapping Large-Cap/Flexi-Cap schemes
        const flexiAndLargeCount = investments.filter(f => f.category.toLowerCase().includes('flexi') || f.category.toLowerCase().includes('large')).length;
        if (flexiAndLargeCount >= 2) {
            recommendations.push({
                type: 'Overlap Elimination',
                icon: '🔍',
                title: 'Overlap in Heavyweight Holdings',
                description: 'Your flexi-cap and large-cap funds share 35-45% duplicate stock weights in banking and IT leaders. Retain the higher-alpha active manager and redirect new SIPs to an under-represented asset class.'
            });
        }

        // Step-up compounding advice
        recommendations.push({
            type: 'Compounding Acceleration',
            icon: '🚀',
            title: 'Deploy an Annual 10% Step-Up SIP',
            description: 'Instituting an automated annual step-up SIP increases your terminal corpus by over 42% over a 10-year holding period, effortlessly scaling with your income.'
        });

        res.json({
            hasHoldings: true,
            healthScore,
            healthRating: healthScore >= 85 ? 'Institutional Grade' : healthScore >= 70 ? 'Healthy' : 'Needs Rebalancing',
            summary: {
                totalInvested,
                currentValue,
                overallGain,
                overallReturnPercent,
                schemesCount: investments.length,
                externalSchemesCount: investments.filter(i => i.isExternal).length
            },
            allocation,
            fundReviews,
            recommendations,
            cfoPersona: {
                name: 'Live Investments AI CFO',
                title: 'Chief Financial Officer & Portfolio Diagnostician',
                philosophy: 'Disciplined capital allocation, low portfolio churn, downside capital preservation.'
            }
        });

    } catch (error) {
        console.error('AI CFO Analysis Error:', error);
        res.status(500).json({ error: 'Failed to generate AI CFO portfolio analysis.' });
    }
});

export default router;
