import crypto from 'node:crypto';
import express from 'express';
import mongoose from 'mongoose';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { connectDB } from '../db.js';
import User from '../models/User.js';
import Investment from '../models/Investment.js';
import Transaction from '../models/Transaction.js';
import PortfolioValuation from '../models/PortfolioValuation.js';
import { analyzePortfolio } from '../services/portfolioAnalytics.js';
import { callMintoTool, openMintoMcp } from '../services/mintoMcp.js';

const router = express.Router();
const validAmount = value => Number.isFinite(Number(value)) && Number(value) > 0;

router.get('/', authMiddleware, async (req, res) => {
    try {
        await connectDB();
        const [user, investments] = await Promise.all([
            User.findById(req.userId).select('name email pan phone'),
            Investment.find({ userId: req.userId })
        ]);
        if (!user) return res.status(404).json({ error: 'User not found' });

        const analysis = analyzePortfolio(investments);
        return res.json({
            profile: {
                name: user.name,
                email: user.email,
                pan: user.pan,
                phone: user.phone || ''
            },
            portfolio: {
                totalInvested: analysis.totalInvested,
                currentValue: analysis.currentValue,
                investments: investments.map(investment => ({
                    id: investment._id.toString(),
                    fundId: investment.fundId,
                    schemeCode: investment.schemeCode || null,
                    name: investment.fundName,
                    category: investment.category,
                    investedAmount: investment.investedAmount,
                    currentValue: investment.currentValue,
                    returnsPercent: investment.returnsPercent,
                    asOf: investment.updatedAt,
                    isExternal: investment.isExternal || false,
                    source: investment.source || 'User-recorded snapshot'
                }))
            }
        });
    } catch (error) {
        console.error('Fetch portfolio failed:', error.name || 'UnknownError');
        return res.status(500).json({ error: 'Unable to load your portfolio.' });
    }
});

router.get('/explore', async (req, res) => {
    let mcpClient;
    try {
        const query = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : 'equity';
        mcpClient = await openMintoMcp();
        const result = await callMintoTool(mcpClient, 'search_funds', { q: query, limit: 12 });
        return res.json(JSON.parse(result));
    } catch (error) {
        console.error('Public fund search failed:', error.name || 'UnknownError');
        return res.status(502).json({ error: 'Verified public fund research is temporarily unavailable.' });
    } finally {
        if (mcpClient) await mcpClient.close();
    }
});

router.post('/invest', authMiddleware, (req, res) => res.status(409).json({
    error: 'This app does not execute mutual-fund orders. Invest through a regulated provider, then record the actual transaction or statement values.'
}));

router.post('/import-external', authMiddleware, async (req, res) => {
    try {
        await connectDB();
        const funds = req.body?.funds;
        if (!Array.isArray(funds) || funds.length === 0 || funds.length > 50) {
            return res.status(400).json({ error: 'Provide between 1 and 50 actual holding snapshots.' });
        }

        const normalized = funds.map(item => ({
            fundName: String(item?.fundName || item?.name || '').trim().slice(0, 200),
            category: String(item?.category || 'Unspecified').trim().slice(0, 100),
            schemeCode: item?.schemeCode === undefined || item?.schemeCode === ''
                ? undefined
                : String(item.schemeCode).trim(),
            investedAmount: Number(item?.investedAmount ?? item?.amount),
            currentValue: Number(item?.currentValue)
        }));
        if (normalized.some(item =>
            !item.fundName ||
            !Number.isFinite(item.investedAmount) ||
            item.investedAmount < 0 ||
            !Number.isFinite(item.currentValue) ||
            item.currentValue < 0 ||
            (item.schemeCode !== undefined && !/^\d{1,20}$/.test(item.schemeCode)) ||
            (item.investedAmount === 0 && item.currentValue === 0)
        )) {
            return res.status(400).json({
                error: 'Each holding needs a fund name and actual non-negative invested and current values; estimated defaults are not accepted.'
            });
        }

        const asOfDate = req.body?.asOfDate === undefined
            ? new Date()
            : new Date(`${String(req.body.asOfDate)}T00:00:00.000Z`);
        if (
            Number.isNaN(asOfDate.getTime()) ||
            (req.body?.asOfDate !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(String(req.body.asOfDate))) ||
            (req.body?.asOfDate !== undefined &&
                asOfDate.toISOString().slice(0, 10) !== String(req.body.asOfDate)) ||
            asOfDate > new Date()
        ) {
            return res.status(400).json({ error: 'Provide a valid statement date that is not in the future.' });
        }

        const imported = [];
        for (const item of normalized) {
            let investment = await Investment.findOne({
                userId: req.userId,
                fundName: item.fundName
            });
            const returnsPercent = item.investedAmount > 0
                ? Number((((item.currentValue - item.investedAmount) / item.investedAmount) * 100).toFixed(2))
                : 0;

            if (investment) {
                investment.category = item.category;
                if (item.schemeCode) investment.schemeCode = item.schemeCode;
                investment.investedAmount = item.investedAmount;
                investment.currentValue = item.currentValue;
                investment.returnsPercent = returnsPercent;
                investment.isExternal = true;
                investment.source = 'Manual statement entry';
            } else {
                investment = new Investment({
                    userId: req.userId,
                    fundId: `manual-${crypto.randomUUID()}`,
                    ...(item.schemeCode ? { schemeCode: item.schemeCode } : {}),
                    fundName: item.fundName,
                    category: item.category,
                    investedAmount: item.investedAmount,
                    currentValue: item.currentValue,
                    returnsPercent,
                    isExternal: true,
                    source: 'Manual statement entry'
                });
            }
            await investment.save();
            await PortfolioValuation.findOneAndUpdate(
                {
                    userId: req.userId,
                    investmentId: investment._id,
                    asOfDate
                },
                {
                    $set: {
                        fundName: investment.fundName,
                        schemeCode: investment.schemeCode,
                        investedAmount: item.investedAmount,
                        currentValue: item.currentValue,
                        source: 'Manual statement entry'
                    }
                },
                { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
            );
            imported.push(investment._id);
        }

        return res.status(201).json({
            message: `Saved ${imported.length} user-entered holding snapshot(s). No MF Central connection was performed.`,
            importedCount: imported.length
        });
    } catch (error) {
        console.error('Saving holding snapshots failed:', error.name || 'UnknownError');
        return res.status(500).json({ error: 'Unable to save holding snapshots.' });
    }
});

router.get('/valuations', authMiddleware, async (req, res) => {
    try {
        await connectDB();
        const snapshots = await PortfolioValuation.find({ userId: req.userId })
            .sort({ asOfDate: -1 })
            .limit(1000)
            .lean();
        return res.json({ snapshots });
    } catch (error) {
        console.error('Loading valuation history failed:', error.name || 'UnknownError');
        return res.status(500).json({ error: 'Unable to load valuation history.' });
    }
});

router.get('/transactions', authMiddleware, async (req, res) => {
    try {
        await connectDB();
        const transactions = await Transaction.find({ userId: req.userId })
            .sort({ date: -1 })
            .limit(500)
            .lean();
        return res.json({ transactions });
    } catch (error) {
        console.error('Loading transaction history failed:', error.name || 'UnknownError');
        return res.status(500).json({ error: 'Unable to load transaction history.' });
    }
});

router.post('/transactions', authMiddleware, async (req, res) => {
    try {
        await connectDB();
        const { investmentId, type, amount, units, nav, date } = req.body || {};
        const transactionDate = new Date(date);
        const validTypes = ['purchase', 'sip', 'redemption', 'dividend'];
        if (
            !mongoose.isValidObjectId(investmentId) ||
            !validTypes.includes(type) ||
            !validAmount(amount) ||
            Number(amount) > 1000000000000 ||
            typeof date !== 'string' ||
            !date.trim() ||
            Number.isNaN(transactionDate.getTime()) ||
            transactionDate > new Date() ||
            ((units !== undefined || nav !== undefined) &&
                (!validAmount(units) || !validAmount(nav)))
        ) {
            return res.status(400).json({ error: 'Provide a valid holding, transaction type, amount, date, and optional units/NAV.' });
        }

        const investment = await Investment.findOne({ _id: investmentId, userId: req.userId });
        if (!investment) return res.status(404).json({ error: 'Holding not found in your account.' });

        const transaction = await Transaction.create({
            userId: req.userId,
            investmentId: investment._id,
            fundName: investment.fundName,
            type,
            amount: Number(amount),
            ...(units !== undefined ? { units: Number(units), nav: Number(nav) } : {}),
            date: transactionDate,
            source: 'Manual transaction record'
        });
        return res.status(201).json({ transaction });
    } catch (error) {
        console.error('Recording transaction failed:', error.name || 'UnknownError');
        return res.status(500).json({ error: 'Unable to record transaction.' });
    }
});

router.get('/ai-analysis', authMiddleware, async (req, res) => {
    try {
        await connectDB();
        const [holdings, transactions] = await Promise.all([
            Investment.find({ userId: req.userId }).lean(),
            Transaction.find({ userId: req.userId }).sort({ date: 1 }).lean()
        ]);
        if (!holdings.length) {
            return res.json({
                hasHoldings: false,
                message: 'No holding snapshots are recorded for this account.'
            });
        }
        const analysis = analyzePortfolio(holdings, transactions);
        return res.json({
            hasHoldings: true,
            summary: analysis,
            holdings: holdings.map(item => ({
                fundName: item.fundName,
                category: item.category,
                investedAmount: item.investedAmount,
                currentValue: item.currentValue,
                returnsPercent: item.returnsPercent,
                asOf: item.updatedAt,
                source: item.source || 'User-recorded snapshot'
            }))
        });
    } catch (error) {
        console.error('Portfolio analysis failed:', error.name || 'UnknownError');
        return res.status(500).json({ error: 'Unable to analyze your recorded portfolio.' });
    }
});

export default router;
