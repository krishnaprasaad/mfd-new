#!/usr/bin/env node

/**
 * Live Investments Model Context Protocol (MCP) Server
 * Exposes tools for AI models to query investor portfolios, sync MF Central external folios,
 * explore mutual funds, and run AI CFO portfolio diagnostics.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

// Ensure .env is loaded
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

import { connectDB } from './server/db.js';
import User from './server/models/User.js';
import Investment from './server/models/Investment.js';

// Initialize the MCP Server
const server = new McpServer({
    name: 'live-investments-cfo',
    version: '1.0.0'
});

// Helper: Find user by email or PAN
async function findUser(identifier) {
    await connectDB();
    const clean = identifier.trim();
    return await User.findOne({
        $or: [
            { email: clean.toLowerCase() },
            { pan: clean.toUpperCase() },
            { email: { $regex: new RegExp(`^${clean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } }
        ]
    });
}

// -------------------------------------------------------------
// TOOL 1: Get User Portfolio
// -------------------------------------------------------------
server.tool(
    'get_user_portfolio',
    'Fetches an investor\'s portfolio holdings, total invested capital, current valuation, and returns from MongoDB.',
    {
        emailOrPan: z.string().describe('Investor email address or PAN card number')
    },
    async ({ emailOrPan }) => {
        try {
            const user = await findUser(emailOrPan);
            if (!user) {
                return {
                    content: [{ type: 'text', text: `Investor not found with identifier: ${emailOrPan}` }]
                };
            }

            const investments = await Investment.find({ userId: user._id });
            let totalInvested = 0;
            let currentValue = 0;

            investments.forEach(inv => {
                totalInvested += inv.investedAmount;
                currentValue += inv.currentValue;
            });

            const overallGain = currentValue - totalInvested;
            const overallReturns = totalInvested > 0 ? Number(((overallGain / totalInvested) * 100).toFixed(2)) : 0;

            const result = {
                investor: {
                    name: user.name,
                    email: user.email,
                    pan: user.pan,
                    phone: user.phone || 'N/A'
                },
                summary: {
                    totalInvested,
                    currentValue,
                    overallGain,
                    overallReturnsPercent: overallReturns,
                    holdingCount: investments.length,
                    mfCentralSyncedCount: investments.filter(i => i.isExternal).length
                },
                holdings: investments.map(inv => ({
                    id: inv._id.toString(),
                    name: inv.fundName,
                    category: inv.category,
                    source: inv.source || 'Direct',
                    isExternal: inv.isExternal || false,
                    investedAmount: inv.investedAmount,
                    currentValue: inv.currentValue,
                    returnsPercent: inv.returnsPercent
                }))
            };

            return {
                content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
            };
        } catch (err) {
            return {
                isError: true,
                content: [{ type: 'text', text: `Error fetching portfolio: ${err.message}` }]
            };
        }
    }
);

// -------------------------------------------------------------
// TOOL 2: Import MF Central CAS Folios
// -------------------------------------------------------------
server.tool(
    'import_mf_central_cas',
    'Imports external mutual fund folios from CAMS & KFintech CAS (MF Central) into the investor\'s portfolio.',
    {
        emailOrPan: z.string().describe('Investor email address or PAN card number'),
        funds: z.array(z.object({
            name: z.string().describe('Mutual fund scheme name (e.g., Axis Bluechip Fund)'),
            category: z.string().default('Equity').describe('Category (e.g., Large Cap, Flexi Cap, Small Cap, Hybrid)'),
            investedAmount: z.number().positive().describe('Invested amount in INR'),
            currentValue: z.number().optional().describe('Current valuation in INR')
        })).describe('List of external mutual fund folios to import')
    },
    async ({ emailOrPan, funds }) => {
        try {
            const user = await findUser(emailOrPan);
            if (!user) {
                return {
                    isError: true,
                    content: [{ type: 'text', text: `Investor not found with identifier: ${emailOrPan}` }]
                };
            }

            const imported = [];
            for (const item of funds) {
                const fundName = item.name.trim();
                const category = item.category || 'Equity';
                const investedAmount = item.investedAmount;
                const currentValue = item.currentValue || Math.round(investedAmount * 1.15);
                const returnsPercent = investedAmount > 0 ? Number((((currentValue - investedAmount) / investedAmount) * 100).toFixed(2)) : 0;

                let investment = await Investment.findOne({ userId: user._id, fundName });
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
                        userId: user._id,
                        fundId: `mfc-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
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

            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify({
                        success: true,
                        message: `Successfully synced ${imported.length} external folios via MF Central for ${user.name}.`,
                        importedCount: imported.length,
                        schemes: imported.map(i => ({ name: i.fundName, category: i.category, currentValue: i.currentValue }))
                    }, null, 2)
                }]
            };
        } catch (err) {
            return {
                isError: true,
                content: [{ type: 'text', text: `Error importing external folios: ${err.message}` }]
            };
        }
    }
);

// -------------------------------------------------------------
// TOOL 3: AI CFO Portfolio Analysis
// -------------------------------------------------------------
server.tool(
    'analyze_portfolio_cfo',
    'Runs institutional AI CFO diagnostics on an investor\'s mutual fund portfolio. Returns health score, category allocation, scheme pros & cons, overlap risks, and personal recommendations.',
    {
        emailOrPan: z.string().describe('Investor email address or PAN card number')
    },
    async ({ emailOrPan }) => {
        try {
            const user = await findUser(emailOrPan);
            if (!user) {
                return {
                    isError: true,
                    content: [{ type: 'text', text: `Investor not found with identifier: ${emailOrPan}` }]
                };
            }

            const investments = await Investment.find({ userId: user._id });
            if (!investments.length) {
                return {
                    content: [{
                        type: 'text',
                        text: JSON.stringify({
                            hasHoldings: false,
                            message: `No investment holdings found for ${user.name}. Import external folios via MF Central or place a direct investment first.`
                        }, null, 2)
                    }]
                };
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
            const overallReturns = totalInvested > 0 ? Number(((overallGain / totalInvested) * 100).toFixed(2)) : 0;

            const allocation = Object.keys(categoryMap).map(cat => ({
                category: cat,
                amount: categoryMap[cat],
                percentage: Number(((categoryMap[cat] / (currentValue || 1)) * 100).toFixed(1))
            }));

            // Scheme-by-scheme pros & cons
            const fundReviews = investments.map(inv => {
                const name = inv.fundName;
                const cat = inv.category || 'Equity';
                const weight = Number(((inv.currentValue / (currentValue || 1)) * 100).toFixed(1));

                const pros = [];
                const cons = [];

                if (cat.toLowerCase().includes('flexi') || name.toLowerCase().includes('flexi')) {
                    pros.push('Dynamic multi-cap flexibility across cycles.');
                    pros.push('Consistent 5-year Sharpe ratio and experienced asset allocation.');
                    cons.push('Overlap with standard large-cap index stocks.');
                } else if (cat.toLowerCase().includes('large') || name.toLowerCase().includes('bluechip')) {
                    pros.push('Institutional liquidity and bluechip stability.');
                    pros.push('Low beta downside capital protection.');
                    cons.push('Moderate alpha over Nifty 50 TRI during bull surges.');
                } else if (cat.toLowerCase().includes('small') || name.toLowerCase().includes('small')) {
                    pros.push('High wealth generation potential over 5+ year horizons.');
                    pros.push('Exposure to rapidly growing niche market leaders.');
                    cons.push('Elevated volatility and sharp interim drawdowns.');
                } else if (cat.toLowerCase().includes('balanced') || cat.toLowerCase().includes('hybrid')) {
                    pros.push('Automatic equity-debt rebalancing dampens market shocks.');
                    pros.push('Superior downside defense and steady compounding.');
                    cons.push('Lags pure equities in sustained bull runs.');
                } else {
                    pros.push('Provides asset class diversification.');
                    cons.push('Monitor annual total expense ratio and tracking error.');
                }

                if (weight > 35) {
                    cons.push(`High single-fund portfolio concentration (${weight}% of total corpus).`);
                }

                return {
                    fundName: name,
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

            // Calculate Health Score
            let healthScore = 75;
            if (investments.length >= 3 && investments.length <= 6) healthScore += 10;
            else if (investments.length > 7) healthScore -= 5;
            if (overallReturns > 12) healthScore += 10;
            if (allocation.some(a => a.percentage > 45)) healthScore -= 6;
            healthScore = Math.min(Math.max(healthScore, 55), 96);

            // Actionable CFO Recommendations
            const recommendations = [];
            if (investments.length > 6) {
                recommendations.push({
                    type: 'Consolidation',
                    title: 'Portfolio Clutter Reduction',
                    detail: `Holding ${investments.length} schemes causes overdiversification without reducing risk. Prune redundant schemes.`
                });
            }

            const top = fundReviews.reduce((max, f) => f.portfolioWeight > max.portfolioWeight ? f : max, fundReviews[0]);
            if (top && top.portfolioWeight > 35) {
                recommendations.push({
                    type: 'Rebalancing',
                    title: `De-concentrate ${top.fundName}`,
                    detail: `${top.fundName} represents ${top.portfolioWeight}% of total holdings. Cap single schemes at 25% max.`
                });
            }

            const hasDebtOrHybrid = allocation.some(a => a.category.toLowerCase().includes('hybrid') || a.category.toLowerCase().includes('balanced') || a.category.toLowerCase().includes('debt'));
            if (!hasDebtOrHybrid && totalInvested >= 20000) {
                recommendations.push({
                    type: 'Downside Defense',
                    title: 'Add a 15% Hybrid / Volatility Hedge',
                    detail: 'Portfolio is 100% equity-exposed. Adding a Dynamic Asset Allocation Fund cushions drawdown shocks.'
                });
            }

            recommendations.push({
                type: 'Compounding Acceleration',
                title: 'Annual 10% Step-Up SIP',
                detail: 'Increase monthly investments by 10% yearly to expand 10-year terminal corpus by ~42%.'
            });

            const report = {
                investor: user.name,
                cfoSummary: {
                    healthScore,
                    healthRating: healthScore >= 85 ? 'Institutional Grade' : healthScore >= 70 ? 'Healthy' : 'Needs Optimization',
                    totalInvested,
                    currentValue,
                    overallGain,
                    overallReturnsPercent: overallReturns,
                    totalSchemes: investments.length,
                    mfCentralFolios: investments.filter(i => i.isExternal).length
                },
                assetAllocation: allocation,
                recommendations,
                schemeReviews: fundReviews
            };

            return {
                content: [{ type: 'text', text: JSON.stringify(report, null, 2) }]
            };
        } catch (err) {
            return {
                isError: true,
                content: [{ type: 'text', text: `AI CFO Diagnostic Error: ${err.message}` }]
            };
        }
    }
);

// -------------------------------------------------------------
// TOOL 4: Explore Curated Mutual Funds
// -------------------------------------------------------------
server.tool(
    'explore_curated_mutual_funds',
    'Returns top curated mutual funds with categories, risk parameters, and 1Y/3Y historical CAGR returns.',
    {
        category: z.string().optional().describe('Optional category filter (e.g., "Flexi Cap", "Large Cap", "Small Cap")')
    },
    async ({ category }) => {
        const funds = [
            { id: 'f-001', name: 'Parag Parikh Flexi Cap Fund', category: 'Flexi Cap', risk: 'High', minSip: 1000, return1Yr: 38.5, return3Yr: 24.2 },
            { id: 'f-002', name: 'HDFC Flexi Cap Fund', category: 'Flexi Cap', risk: 'High', minSip: 500, return1Yr: 41.2, return3Yr: 26.8 },
            { id: 'f-003', name: 'Mirae Asset Large Cap Fund', category: 'Large Cap', risk: 'Moderate', minSip: 1000, return1Yr: 29.4, return3Yr: 18.6 },
            { id: 'f-004', name: 'Nippon India Small Cap Fund', category: 'Small Cap', risk: 'Very High', minSip: 500, return1Yr: 46.8, return3Yr: 31.5 },
            { id: 'f-005', name: 'SBI Bluechip Fund', category: 'Large Cap', risk: 'Moderate', minSip: 500, return1Yr: 27.2, return3Yr: 17.4 },
            { id: 'f-006', name: 'ICICI Prudential Technology Fund', category: 'Sectoral / Tech', risk: 'Very High', minSip: 1000, return1Yr: 44.1, return3Yr: 28.9 }
        ];

        const filtered = category ? funds.filter(f => f.category.toLowerCase().includes(category.toLowerCase())) : funds;

        return {
            content: [{ type: 'text', text: JSON.stringify(filtered, null, 2) }]
        };
    }
);

// Start the server over Stdio
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('✅ Live Investments MCP Server running on Stdio');
}

main().catch(err => {
    console.error('Fatal MCP Server error:', err);
    process.exit(1);
});

