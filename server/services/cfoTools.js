import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import Investment from '../models/Investment.js';
import Transaction from '../models/Transaction.js';
import PortfolioValuation from '../models/PortfolioValuation.js';
import {
    analyzePortfolio,
    calculateSipAnalysis,
    calculateXirr,
    comparePortfolioSnapshot
} from './portfolioAnalytics.js';
import { callMintoTool } from './mintoMcp.js';

const getPortfolioData = async (userId, InvestmentModel, TransactionModel) => {
    const [holdings, transactions] = await Promise.all([
        InvestmentModel.find({ userId }).lean(),
        TransactionModel.find({ userId }).sort({ date: 1 }).lean()
    ]);
    return { holdings, transactions };
};

export const createPortfolioTools = (
    authenticatedUserId,
    {
        InvestmentModel = Investment,
        TransactionModel = Transaction,
        ValuationModel = PortfolioValuation,
        now = () => new Date()
    } = {}
) => {
    if (!authenticatedUserId) throw new Error('Authenticated user identity is required.');

    return [
        tool(async () => {
            const { holdings, transactions } = await getPortfolioData(
                authenticatedUserId,
                InvestmentModel,
                TransactionModel
            );
            return JSON.stringify(analyzePortfolio(holdings, transactions, now()));
        }, {
            name: 'get_portfolio_summary',
            description: 'Get deterministic totals, snapshot returns, allocation, concentration, XIRR/CAGR when dated transaction data is sufficient, and data limitations for the signed-in user.',
            schema: z.object({})
        }),
        tool(async ({ yearsAgo }) => {
            const [holdings, snapshots] = await Promise.all([
                InvestmentModel.find({ userId: authenticatedUserId }).lean(),
                ValuationModel.find({ userId: authenticatedUserId }).lean()
            ]);
            return JSON.stringify(comparePortfolioSnapshot(holdings, snapshots, yearsAgo, now()));
        }, {
            name: 'compare_portfolio_with_past',
            description: 'Compare current portfolio value with a complete user-entered statement snapshot near a prior year. Returns unavailable if a complete same-date historical snapshot is missing.',
            schema: z.object({
                yearsAgo: z.number().int().min(1).max(10).default(1)
            })
        }),
        tool(async () => {
            const { holdings } = await getPortfolioData(
                authenticatedUserId,
                InvestmentModel,
                TransactionModel
            );
            return JSON.stringify(holdings.map(holding => ({
                fundName: holding.fundName,
                category: holding.category,
                investedAmount: holding.investedAmount,
                currentValue: holding.currentValue,
                asOf: holding.updatedAt || null,
                source: holding.source || 'User-recorded snapshot'
            })));
        }, {
            name: 'get_client_portfolio',
            description: 'Get only the signed-in user’s recorded holdings and their snapshot values. Use this for fund names or holding-specific questions.',
            schema: z.object({})
        }),
        tool(async ({ fundName }) => {
            const { holdings, transactions } = await getPortfolioData(
                authenticatedUserId,
                InvestmentModel,
                TransactionModel
            );
            let selectedHoldings = holdings;
            if (fundName) {
                const normalizedName = fundName.trim().toLowerCase();
                selectedHoldings = holdings.filter(item =>
                    String(item.fundName).trim().toLowerCase() === normalizedName
                );
                if (selectedHoldings.length !== 1) {
                    return JSON.stringify({
                        available: false,
                        reason: selectedHoldings.length
                            ? 'The fund name matches multiple holdings; specify the exact holding.'
                            : 'The requested fund is not present in the signed-in user’s recorded holdings.'
                    });
                }
            }
            const selectedIds = new Set(selectedHoldings.map(item => String(item._id)));
            const selectedTransactions = transactions.filter(item =>
                selectedIds.has(String(item.investmentId))
            );
            const currentValue = selectedHoldings.reduce((sum, item) => sum + Number(item.currentValue || 0), 0);
            const flows = selectedTransactions.flatMap(item => {
                if (['purchase', 'sip'].includes(item.type)) {
                    return [{ amount: -Number(item.amount), date: item.date }];
                }
                if (['redemption', 'dividend'].includes(item.type)) {
                    return [{ amount: Number(item.amount), date: item.date }];
                }
                return [];
            });
            if (currentValue > 0) flows.push({ amount: currentValue, date: now() });
            const xirrPercent = calculateXirr(flows);
            return JSON.stringify({
                xirrPercent,
                asOf: now().toISOString(),
                transactionCount: transactions.length,
                available: xirrPercent !== null,
                fundName: fundName || null,
                reason: xirrPercent === null
                    ? 'A dated ledger with at least one investment outflow and one inflow/current valuation is required.'
                    : undefined
            });
        }, {
            name: 'calculate_xirr',
            description: 'Calculate annualized XIRR deterministically from the signed-in user’s dated purchase, SIP, redemption and dividend records plus the recorded current value. Optionally calculate one exact holding by fundName. Returns available:false instead of estimating when required data is absent or ambiguous.',
            schema: z.object({
                fundName: z.string().min(1).max(160).optional()
            })
        }),
        tool(async () => {
            const { holdings, transactions } = await getPortfolioData(
                authenticatedUserId,
                InvestmentModel,
                TransactionModel
            );
            const summary = analyzePortfolio(holdings, transactions, now());
            return JSON.stringify({
                allocation: summary.allocation,
                asOf: summary.asOf,
                basis: 'User-recorded current-value snapshots grouped by stored fund category.',
                limitation: 'Fund category is not a verified underlying asset or sector allocation.'
            });
        }, {
            name: 'get_asset_allocation',
            description: 'Calculate category allocation from the signed-in user’s current-value snapshots; state the basis and missing underlying asset/sector detail.',
            schema: z.object({})
        }),
        tool(async () => {
            const { holdings, transactions } = await getPortfolioData(
                authenticatedUserId,
                InvestmentModel,
                TransactionModel
            );
            const summary = analyzePortfolio(holdings, transactions, now());
            return JSON.stringify({
                largestHoldings: summary.concentration.slice(0, 5),
                categoryWeights: summary.allocation,
                asOf: summary.asOf,
                unavailable: [
                    'Underlying security-level diversification and portfolio overlap require verified fund holdings.',
                    'Volatility, drawdown and benchmark-relative risk require dated NAV and benchmark series.'
                ]
            });
        }, {
            name: 'analyze_portfolio_risk',
            description: 'Show concentration derived from recorded holding values and explicitly identify risks that cannot be measured without verified fund holdings and NAV history.',
            schema: z.object({})
        }),
        tool(async ({ limit }) => {
            const transactions = await TransactionModel.find({ userId: authenticatedUserId })
                .sort({ date: -1 })
                .limit(limit)
                .lean();
            return JSON.stringify(transactions.map(item => ({
                fundName: item.fundName,
                type: item.type,
                amount: item.amount,
                units: item.units ?? null,
                nav: item.nav ?? null,
                date: item.date,
                source: item.source
            })));
        }, {
            name: 'get_transaction_history',
            description: 'Retrieve only the signed-in user’s dated investment transactions.',
            schema: z.object({
                limit: z.number().int().min(1).max(50).default(20)
            })
        }),
        tool(async ({ fundName }) => {
            let holdings = await InvestmentModel.find({ userId: authenticatedUserId }).lean();
            if (fundName) {
                const normalizedName = fundName.trim().toLowerCase();
                holdings = holdings.filter(item => String(item.fundName).trim().toLowerCase() === normalizedName);
                if (holdings.length !== 1) {
                    return JSON.stringify({
                        available: false,
                        reason: holdings.length
                            ? 'The fund name matches multiple holdings; specify the exact holding.'
                            : 'The requested fund is not present in the signed-in user’s recorded holdings.'
                    });
                }
            }
            const investmentIds = holdings.map(item => item._id);
            const transactions = await TransactionModel.find({
                userId: authenticatedUserId,
                ...(fundName ? { investmentId: { $in: investmentIds } } : {})
            }).sort({ date: 1 }).lean();
            return JSON.stringify(calculateSipAnalysis(holdings, transactions, now()));
        }, {
            name: 'get_sip_analysis',
            description: 'Summarize actual dated SIP contribution records for the signed-in user, optionally scoped to one exact fundName; do not infer SIP performance from a total holding snapshot.',
            schema: z.object({
                fundName: z.string().min(1).max(160).optional()
            })
        }),
        tool(async ({ monthlyContribution, years, annualRatePercent, initialInvestment }) => {
            const monthlyRate = Math.pow(1 + annualRatePercent / 100, 1 / 12) - 1;
            const months = years * 12;
            const contributionFutureValue = monthlyRate === 0
                ? monthlyContribution * months
                : monthlyContribution * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate) * (1 + monthlyRate);
            const startingValueFutureValue = initialInvestment * Math.pow(1 + monthlyRate, months);
            const futureValue = contributionFutureValue + startingValueFutureValue;
            return JSON.stringify({
                initialInvestment,
                futureValueOfInitialInvestment: Number(startingValueFutureValue.toFixed(2)),
                assumedMonthlyContribution: monthlyContribution,
                assumedAnnualRatePercent: annualRatePercent,
                years,
                projectedValue: Number(futureValue.toFixed(2)),
                totalContributions: monthlyContribution * months,
                disclaimer: 'Illustrative scenario only. The assumed rate is not a forecast or guaranteed return.'
            });
        }, {
            name: 'project_monthly_investment',
            description: 'Calculate a deterministic monthly-contribution future-value scenario from user-provided assumptions. Never describe the assumed rate as expected or guaranteed.',
            schema: z.object({
                monthlyContribution: z.number().nonnegative().max(100000000),
                years: z.number().positive().max(100),
                annualRatePercent: z.number().min(-99).max(100),
                initialInvestment: z.number().nonnegative().max(1000000000000).default(0)
            })
        })
    ];
};

export const createPublicFundTools = mcpClient => [
    tool(async ({ query, category, amc }) => callMintoTool(mcpClient, 'search_funds', {
        q: query.slice(0, 100),
        ...(category ? { category } : {}),
        ...(amc ? { amc } : {}),
        limit: 6
    }), {
        name: 'search_public_funds',
        description: 'Search current public mutual-fund records. Use this before discussing a fund that is not present in the user portfolio; cite the returned source.',
        schema: z.object({
            query: z.string().min(1).max(100),
            category: z.string().max(100).optional(),
            amc: z.string().max(100).optional()
        })
    }),
    tool(async ({ schemeCode }) => {
        const [details, nav, returns, metrics] = await Promise.all([
            callMintoTool(mcpClient, 'get_fund', { scheme_code: schemeCode }),
            callMintoTool(mcpClient, 'get_latest_nav', { scheme_code: schemeCode }),
            callMintoTool(mcpClient, 'get_trailing_returns', { scheme_code: schemeCode }),
            callMintoTool(mcpClient, 'get_metrics', { scheme_code: schemeCode })
        ]);
        return JSON.stringify({ details, latestNav: nav, trailingReturns: returns, riskMetrics: metrics });
    }, {
        name: 'get_public_fund_research',
        description: 'Retrieve a public fund’s details, latest NAV, trailing returns, and risk metrics by verified AMFI scheme code from the configured MCP source.',
        schema: z.object({ schemeCode: z.string().min(1).max(20) })
    }),
    tool(async ({ schemeCodes }) => callMintoTool(mcpClient, 'compare_funds', {
        scheme_codes: schemeCodes
    }), {
        name: 'compare_public_funds',
        description: 'Compare 2 to 10 public mutual funds by their AMFI scheme codes using the MCP data source.',
        schema: z.object({
            schemeCodes: z.array(z.string().min(1).max(20)).min(2).max(10)
        })
    }),
    tool(async ({ schemeCodes }) => {
        const results = await Promise.all(schemeCodes.map(async schemeCode => {
            const response = await mcpClient.callTool({
                name: 'get_holdings',
                arguments: { scheme_code: schemeCode, limit: 50 }
            });
            if (response.isError) throw new Error('Public fund holdings lookup failed.');
            const text = response.content?.find(item => item.type === 'text')?.text || '';
            let data;
            try {
                data = JSON.parse(text);
            } catch {
                throw new Error('Public fund holdings response was not valid JSON.');
            }
            return { schemeCode, data };
        }));
        const holdingMaps = results.map(({ data }) => new Map(
            (Array.isArray(data.holdings) ? data.holdings : [])
                .filter(item => item && typeof item.instrument_name === 'string')
                .map(item => [item.isin || item.instrument_name, {
                    name: item.instrument_name,
                    industry: item.industry || null,
                    weightPercent: Number(item.pct_nav) * 100
                }])
        ));
        const overlaps = [];
        for (const [key, first] of holdingMaps[0]) {
            const matched = holdingMaps.slice(1).every(map => map.has(key));
            if (matched) {
                overlaps.push({
                    holding: first.name,
                    industry: first.industry,
                    weightsByFundPercent: holdingMaps.map(map => Number(map.get(key).weightPercent.toFixed(2))),
                    minimumCommonWeightPercent: Number(Math.min(
                        ...holdingMaps.map(map => map.get(key).weightPercent)
                    ).toFixed(2))
                });
            }
        }
        return JSON.stringify({
            source: 'Sukoon public mutual-fund MCP',
            retrievedAt: new Date().toISOString(),
            funds: results.map(({ schemeCode, data }) => ({
                schemeCode,
                schemeName: data.scheme_name || null,
                asOfDate: data.as_of_date || null
            })),
            exactCommonHoldings: overlaps.sort((a, b) =>
                b.minimumCommonWeightPercent - a.minimumCommonWeightPercent
            ).slice(0, 20),
            limitation: 'Overlap is limited to exact names present in the returned top holdings; undisclosed holdings may be omitted.'
        }).slice(0, 16000);
    }, {
        name: 'analyze_public_fund_overlap',
        description: 'Retrieve official-source top holdings for 2 to 5 funds for comparison. Report only holdings directly present in the returned data and disclose top-holdings coverage limitations.',
        schema: z.object({
            schemeCodes: z.array(z.string().min(1).max(20)).min(2).max(5)
        })
    }),
    tool(async ({ schemeCode, fromDate, toDate }) => callMintoTool(mcpClient, 'get_nav_history', {
        scheme_code: schemeCode,
        ...(fromDate ? { from_date: fromDate } : {}),
        ...(toDate ? { to_date: toDate } : {})
    }), {
        name: 'get_public_fund_nav_history',
        description: 'Retrieve dated public NAV history for a verified AMFI scheme code.',
        schema: z.object({
            schemeCode: z.string().min(1).max(20),
            fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
            toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
        })
    })
];

const getMcpJson = async (client, name, args) => {
    const result = await client.callTool({ name, arguments: args });
    if (result.isError) throw new Error(`Public fund data tool ${name} returned an error.`);
    const text = result.content?.find(item => item.type === 'text')?.text || '';
    try {
        return JSON.parse(text);
    } catch {
        throw new Error(`Public fund data tool ${name} returned invalid JSON.`);
    }
};

const getDisclosedHoldings = async (client, fund) => {
    const data = await getMcpJson(client, 'get_holdings', {
        scheme_code: fund.schemeCode,
        limit: 50
    });
    const bySecurity = new Map(
        (Array.isArray(data.holdings) ? data.holdings : [])
            .filter(item => item && typeof item.instrument_name === 'string')
            .map(item => [item.isin || item.instrument_name, {
                name: item.instrument_name,
                industry: item.industry || 'Unspecified',
                weightPercent: Number(item.pct_nav) * 100
            }])
    );
    return {
        fundName: fund.fundName,
        schemeCode: fund.schemeCode,
        asOfDate: data.as_of_date || null,
        currentValue: Number(fund.currentValue || 0),
        bySecurity
    };
};

export const createClientMarketTools = (
    authenticatedUserId,
    mcpClient,
    InvestmentModel = Investment
) => [
    tool(async () => {
        const holdings = await InvestmentModel.find({ userId: authenticatedUserId }).lean();
        const mapped = holdings.filter(item => item.schemeCode);
        const totalValue = holdings.reduce((sum, item) => sum + Number(item.currentValue || 0), 0);
        if (!mapped.length || totalValue <= 0) {
            return JSON.stringify({
                available: false,
                reason: 'Link at least one holding to an AMFI scheme code and provide a non-zero current-value snapshot.'
            });
        }

        const disclosures = await Promise.all(mapped.map(item => getDisclosedHoldings(mcpClient, item)));
        const sectors = new Map();
        let disclosedValue = 0;
        disclosures.forEach(fund => {
            disclosedValue += fund.currentValue;
            fund.bySecurity.forEach(security => {
                const exposure = fund.currentValue * security.weightPercent / 100;
                sectors.set(security.industry, (sectors.get(security.industry) || 0) + exposure);
            });
        });

        return JSON.stringify({
            available: true,
            source: 'Sukoon public mutual-fund MCP',
            retrievedAt: new Date().toISOString(),
            disclosureCoveragePercent: Number((disclosedValue / totalValue * 100).toFixed(2)),
            sectorExposureAsPercentOfRecordedPortfolio: [...sectors.entries()]
                .map(([sector, value]) => ({
                    sector,
                    estimatedExposure: Number(value.toFixed(2)),
                    percentage: Number((value / totalValue * 100).toFixed(2))
                }))
                .sort((a, b) => b.percentage - a.percentage),
            limitation: 'Exposure uses each fund’s disclosed top 50 holdings, the stored current-value snapshot, and returned sector labels. It does not cover undisclosed holdings.'
        });
    }, {
        name: 'get_client_sector_allocation',
        description: 'Calculate sector exposure for the authenticated user’s holdings from stored AMFI scheme codes and public fund disclosures; report disclosure coverage and limitations.',
        schema: z.object({})
    }),
    tool(async () => {
        const holdings = await InvestmentModel.find({ userId: authenticatedUserId }).lean();
        const mapped = holdings.filter(item => item.schemeCode);
        if (mapped.length < 2) {
            return JSON.stringify({
                available: false,
                reason: 'At least two holdings must have an AMFI scheme code to compare disclosed underlying holdings.'
            });
        }

        const disclosures = await Promise.all(mapped.map(item => getDisclosedHoldings(mcpClient, item)));
        const comparisons = [];
        for (let firstIndex = 0; firstIndex < disclosures.length; firstIndex += 1) {
            for (let secondIndex = firstIndex + 1; secondIndex < disclosures.length; secondIndex += 1) {
                const first = disclosures[firstIndex];
                const second = disclosures[secondIndex];
                const shared = [];
                for (const [securityId, holding] of first.bySecurity) {
                    if (second.bySecurity.has(securityId)) {
                        const other = second.bySecurity.get(securityId);
                        shared.push({
                            holding: holding.name,
                            weightsPercent: [
                                Number(holding.weightPercent.toFixed(2)),
                                Number(other.weightPercent.toFixed(2))
                            ]
                        });
                    }
                }
                comparisons.push({
                    funds: [first.fundName, second.fundName],
                    exactCommonTopHoldings: shared,
                    commonMinimumWeightPercent: Number(shared.reduce((sum, item) =>
                        sum + Math.min(...item.weightsPercent), 0).toFixed(2)),
                    asOfDates: [first.asOfDate, second.asOfDate]
                });
            }
        }
        return JSON.stringify({
            source: 'Sukoon public mutual-fund MCP',
            retrievedAt: new Date().toISOString(),
            comparisons,
            limitation: 'Only exact overlapping names/ISINs within the returned top 50 holdings are counted; this is a lower bound, not complete portfolio overlap.'
        }).slice(0, 16000);
    }, {
        name: 'analyze_client_fund_overlap',
        description: 'Compare the authenticated user’s funds by exact ISIN/name matches in public top-50 fund disclosures. Return a deterministic lower-bound overlap and clearly state coverage limits.',
        schema: z.object({})
    }),
    tool(async ({ fundName, benchmarkName, fromDate, toDate }) => {
        const from = new Date(`${fromDate}T00:00:00Z`);
        const to = new Date(`${toDate}T00:00:00Z`);
        if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from >= to ||
            to - from > 10 * 366 * 24 * 60 * 60 * 1000) {
            return JSON.stringify({ available: false, reason: 'Choose a valid date range no longer than 10 years.' });
        }

        const holding = await InvestmentModel.findOne({
            userId: authenticatedUserId,
            fundName
        }).lean();
        if (!holding?.schemeCode) {
            return JSON.stringify({
                available: false,
                reason: 'This holding is not linked to an AMFI scheme code. Add the code from your statement before comparing it.'
            });
        }

        const [fundHistory, benchmarkHistory] = await Promise.all([
            getMcpJson(mcpClient, 'get_nav_history', {
                scheme_code: holding.schemeCode,
                from_date: fromDate,
                to_date: toDate
            }),
            getMcpJson(mcpClient, 'get_benchmark', {
                index_name: benchmarkName,
                from_date: fromDate,
                to_date: toDate
            })
        ]);
        const fundValues = new Map((fundHistory.data || []).map(item => [item.date, Number(item.nav)]));
        const benchmarkValues = new Map((benchmarkHistory.series || []).map(item => [item.date, Number(item.value)]));
        const sharedDates = [...fundValues.keys()].filter(date => benchmarkValues.has(date)).sort();
        if (sharedDates.length < 2) {
            return JSON.stringify({
                available: false,
                reason: 'The source did not return at least two matching fund-NAV and benchmark dates.'
            });
        }
        const start = sharedDates[0];
        const end = sharedDates.at(-1);
        const fundReturnPercent = (fundValues.get(end) / fundValues.get(start) - 1) * 100;
        const benchmarkReturnPercent =
            (benchmarkValues.get(end) / benchmarkValues.get(start) - 1) * 100;

        return JSON.stringify({
            available: true,
            fundName: holding.fundName,
            benchmark: benchmarkName,
            dateRange: { from: start, to: end },
            commonObservations: sharedDates.length,
            fundReturnPercent: Number(fundReturnPercent.toFixed(2)),
            benchmarkReturnPercent: Number(benchmarkReturnPercent.toFixed(2)),
            differencePercentagePoints: Number((fundReturnPercent - benchmarkReturnPercent).toFixed(2)),
            source: 'Sukoon public mutual-fund MCP',
            limitation: 'Returns are calculated from the first and last shared dates with available NAV and TRI data; this is not risk-adjusted and excludes investor-specific cash flows.'
        });
    }, {
        name: 'compare_client_fund_with_benchmark',
        description: 'Deterministically compare a signed-in user’s fund NAV series with a specified benchmark TRI over a bounded date range. Requires the holding’s AMFI scheme code.',
        schema: z.object({
            fundName: z.string().min(1).max(200),
            benchmarkName: z.string().min(1).max(100),
            fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
            toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
        })
    })
];

export { getPortfolioData };
