const round = value => Number(value.toFixed(2));
const numeric = value => Number.isFinite(Number(value)) ? Number(value) : 0;

export const calculateAbsoluteReturn = (investedAmount, currentValue) => {
    const invested = numeric(investedAmount);
    const value = numeric(currentValue);
    return {
        amount: round(value - invested),
        percentage: invested > 0 ? round(((value - invested) / invested) * 100) : null
    };
};

export const calculateCagr = ({ investedAmount, currentValue, startDate, endDate = new Date() }) => {
    const invested = numeric(investedAmount);
    const value = numeric(currentValue);
    const start = new Date(startDate);
    const end = new Date(endDate);
    const years = (end - start) / (365.25 * 24 * 60 * 60 * 1000);

    if (invested <= 0 || value <= 0 || !Number.isFinite(years) || years <= 0) return null;
    return round((Math.pow(value / invested, 1 / years) - 1) * 100);
};

const xnpv = (rate, cashflows, startTime) => cashflows.reduce((total, flow) => {
    const years = (flow.date.getTime() - startTime) / (365.25 * 24 * 60 * 60 * 1000);
    return total + flow.amount / Math.pow(1 + rate, years);
}, 0);

export const calculateXirr = cashflows => {
    const validFlows = cashflows
        .map(flow => ({ amount: numeric(flow.amount), date: new Date(flow.date) }))
        .filter(flow => flow.amount !== 0 && !Number.isNaN(flow.date.getTime()))
        .sort((a, b) => a.date - b.date);
    const hasOutflow = validFlows.some(flow => flow.amount < 0);
    const hasInflow = validFlows.some(flow => flow.amount > 0);
    if (validFlows.length < 2 || !hasOutflow || !hasInflow) return null;

    const startTime = validFlows[0].date.getTime();
    const minLogRate = Math.log(0.0001);
    const maxLogRate = Math.log(11);
    let previousRate = Math.exp(minLogRate) - 1;
    let previousValue = xnpv(previousRate, validFlows, startTime);
    const samples = 512;

    for (let index = 1; index <= samples; index += 1) {
        const logRate = minLogRate + (maxLogRate - minLogRate) * index / samples;
        const rate = Math.exp(logRate) - 1;
        const value = xnpv(rate, validFlows, startTime);
        if (Number.isFinite(value) && Number.isFinite(previousValue) && Math.sign(value) !== Math.sign(previousValue)) {
            let lower = previousRate;
            let upper = rate;
            let lowerValue = previousValue;

            for (let iteration = 0; iteration < 100; iteration += 1) {
                const middle = (lower + upper) / 2;
                const middleValue = xnpv(middle, validFlows, startTime);
                if (!Number.isFinite(middleValue)) return null;
                if (Math.abs(middleValue) < 0.000001) return round(middle * 100);
                if (Math.sign(middleValue) === Math.sign(lowerValue)) {
                    lower = middle;
                    lowerValue = middleValue;
                } else {
                    upper = middle;
                }
            }

            return round(((lower + upper) / 2) * 100);
        }
        previousRate = rate;
        previousValue = value;
    }

    return null;
};

export const calculateRealizedUnrealized = (holdings, transactions) => {
    if (!transactions.length || holdings.some(holding => !transactions.some(
        transaction => String(transaction.investmentId) === String(holding._id)
    ))) {
        return {
            available: false,
            reason: 'A complete dated transaction ledger is required for every holding.'
        };
    }

    let realizedGain = 0;
    let unrealizedGain = 0;
    let dividendIncome = 0;
    for (const holding of holdings) {
        const history = transactions
            .filter(transaction => String(transaction.investmentId) === String(holding._id))
            .sort((a, b) => new Date(a.date) - new Date(b.date));
        const lots = [];

        for (const transaction of history) {
            if (transaction.type === 'dividend') {
                dividendIncome += numeric(transaction.amount);
                continue;
            }
            if (!['purchase', 'sip', 'redemption'].includes(transaction.type) ||
                !Number.isFinite(Number(transaction.units)) ||
                Number(transaction.units) <= 0 ||
                !Number.isFinite(Number(transaction.nav)) ||
                Number(transaction.nav) <= 0) {
                return {
                    available: false,
                    reason: 'Units and NAV are required for every purchase, SIP and redemption to calculate realized and unrealized gains.'
                };
            }

            if (transaction.type === 'purchase' || transaction.type === 'sip') {
                lots.push({
                    units: Number(transaction.units),
                    unitCost: Number(transaction.amount) / Number(transaction.units)
                });
                continue;
            }

            let unitsToRedeem = Number(transaction.units);
            let costBasis = 0;
            while (unitsToRedeem > 0 && lots.length) {
                const lot = lots[0];
                const redeemedFromLot = Math.min(unitsToRedeem, lot.units);
                costBasis += redeemedFromLot * lot.unitCost;
                lot.units -= redeemedFromLot;
                unitsToRedeem -= redeemedFromLot;
                if (lot.units <= 1e-10) lots.shift();
            }
            if (unitsToRedeem > 1e-8) {
                return {
                    available: false,
                    reason: 'The transaction ledger is incomplete: a redemption exceeds previously recorded units.'
                };
            }
            realizedGain += Number(transaction.amount) - costBasis;
        }

        const remainingCost = lots.reduce((sum, lot) => sum + lot.units * lot.unitCost, 0);
        unrealizedGain += numeric(holding.currentValue) - remainingCost;
    }

    return {
        available: true,
        method: 'FIFO cost basis from recorded units; unrealized values use the user-recorded current-value snapshots.',
        realizedGain: round(realizedGain),
        unrealizedGain: round(unrealizedGain),
        dividendIncome: round(dividendIncome),
        asOf: new Date().toISOString()
    };
};

export const calculateSipAnalysis = (holdings, transactions, asOf = new Date()) => {
    const sipTransactions = transactions.filter(item => item.type === 'sip');
    if (!sipTransactions.length) {
        return { available: false, reason: 'No dated SIP transactions are recorded.' };
    }

    let totalContributions = 0;
    let realizedProceeds = 0;
    let remainingValue = 0;
    const sipFlows = [];
    for (const holding of holdings) {
        const history = transactions
            .filter(item => String(item.investmentId) === String(holding._id))
            .sort((a, b) => new Date(a.date) - new Date(b.date));
        if (history.some(item => item.type === 'dividend' || (
            ['purchase', 'sip', 'redemption'].includes(item.type) &&
            (!Number.isFinite(Number(item.units)) || Number(item.units) <= 0 ||
                !Number.isFinite(Number(item.nav)) || Number(item.nav) <= 0)
        ))) {
            return {
                available: false,
                reason: 'Units, NAV and complete non-dividend transactions are required to calculate SIP performance.'
            };
        }

        const lots = [];
        for (const item of history) {
            if (item.type === 'purchase' || item.type === 'sip') {
                const lot = {
                    units: Number(item.units),
                    unitCost: Number(item.amount) / Number(item.units),
                    isSip: item.type === 'sip'
                };
                lots.push(lot);
                if (lot.isSip) {
                    totalContributions += Number(item.amount);
                    sipFlows.push({ amount: -Number(item.amount), date: item.date });
                }
            } else if (item.type === 'redemption') {
                const redeemedUnits = Number(item.units);
                const proceedsPerUnit = Number(item.amount) / redeemedUnits;
                let unitsToRedeem = redeemedUnits;
                while (unitsToRedeem > 0 && lots.length) {
                    const lot = lots[0];
                    const quantity = Math.min(unitsToRedeem, lot.units);
                    if (lot.isSip) {
                        const proceeds = quantity * proceedsPerUnit;
                        realizedProceeds += proceeds;
                        sipFlows.push({ amount: proceeds, date: item.date });
                    }
                    lot.units -= quantity;
                    unitsToRedeem -= quantity;
                    if (lot.units <= 1e-10) lots.shift();
                }
                if (unitsToRedeem > 1e-8) {
                    return {
                        available: false,
                        reason: 'The transaction ledger is incomplete: a redemption exceeds previously recorded units.'
                    };
                }
            }
        }

        const remainingUnits = lots.reduce((sum, lot) => sum + lot.units, 0);
        const sipUnits = lots.filter(lot => lot.isSip).reduce((sum, lot) => sum + lot.units, 0);
        if (remainingUnits > 0 && sipUnits > 0) {
            const valuePerUnit = numeric(holding.currentValue) / remainingUnits;
            const value = sipUnits * valuePerUnit;
            remainingValue += value;
            sipFlows.push({ amount: value, date: asOf });
        }
    }

    const currentAndRealizedValue = realizedProceeds + remainingValue;
    const absoluteGain = currentAndRealizedValue - totalContributions;
    return {
        available: true,
        contributionCount: sipTransactions.length,
        totalContributions: round(totalContributions),
        valueFromRemainingSipUnits: round(remainingValue),
        redemptionProceedsFromSipUnits: round(realizedProceeds),
        absoluteGain: round(absoluteGain),
        absoluteReturnPercent: totalContributions > 0
            ? round(absoluteGain / totalContributions * 100)
            : null,
        xirrPercent: calculateXirr(sipFlows),
        asOf: new Date(asOf).toISOString(),
        method: 'Uses recorded SIP units, redemption order and user-recorded current-value snapshots; returns are unavailable if the transaction ledger is incomplete.'
    };
};

export const comparePortfolioSnapshot = (holdings, snapshots, yearsAgo = 1, asOf = new Date()) => {
    if (!Number.isInteger(yearsAgo) || yearsAgo < 1 || yearsAgo > 10 || holdings.length === 0) {
        return { available: false, reason: 'A valid one-to-ten-year comparison and current holdings are required.' };
    }

    const targetDate = new Date(asOf);
    targetDate.setUTCFullYear(targetDate.getUTCFullYear() - yearsAgo);
    const currentIds = new Set(holdings.map(item => String(item._id)));
    const groups = new Map();
    snapshots.forEach(snapshot => {
        const key = new Date(snapshot.asOfDate).toISOString().slice(0, 10);
        const group = groups.get(key) || [];
        group.push(snapshot);
        groups.set(key, group);
    });

    const candidates = [...groups.entries()]
        .map(([date, items]) => ({ date, items, distance: Math.abs(new Date(date) - targetDate) }))
        .filter(group =>
            group.distance <= 45 * 24 * 60 * 60 * 1000 &&
            group.items.length === currentIds.size &&
            group.items.every(item => currentIds.has(String(item.investmentId)))
        )
        .sort((a, b) => a.distance - b.distance);
    if (!candidates.length) {
        return {
            available: false,
            reason: `A complete statement snapshot for all current holdings within 45 days of ${targetDate.toISOString().slice(0, 10)} is required.`
        };
    }

    const previous = candidates[0];
    const previousValue = previous.items.reduce((sum, item) => sum + numeric(item.currentValue), 0);
    const currentValue = holdings.reduce((sum, item) => sum + numeric(item.currentValue), 0);
    const change = currentValue - previousValue;
    return {
        available: true,
        fromDate: previous.date,
        toDate: new Date(asOf).toISOString(),
        previousValue: round(previousValue),
        currentValue: round(currentValue),
        change: round(change),
        changePercent: previousValue > 0 ? round(change / previousValue * 100) : null,
        holdingsCompared: currentIds.size,
        method: 'Current user-recorded snapshot compared with a complete historical statement snapshot. This is not a time-weighted investment return.'
    };
};

export const analyzePortfolio = (holdings, transactions = [], asOf = new Date()) => {
    const totalInvested = round(holdings.reduce((sum, item) => sum + numeric(item.investedAmount), 0));
    const currentValue = round(holdings.reduce((sum, item) => sum + numeric(item.currentValue), 0));
    const absoluteReturn = calculateAbsoluteReturn(totalInvested, currentValue);
    const categories = new Map();
    const weights = holdings.map(item => ({
        fundName: item.fundName,
        currentValue: numeric(item.currentValue),
        percentage: currentValue > 0
            ? round((numeric(item.currentValue) / currentValue) * 100)
            : 0
    })).sort((a, b) => b.percentage - a.percentage);
    const holdingPerformance = holdings.map(item => {
        const change = calculateAbsoluteReturn(item.investedAmount, item.currentValue);
        return {
            fundName: item.fundName,
            investedAmount: numeric(item.investedAmount),
            currentValue: numeric(item.currentValue),
            absoluteReturnAmount: change.amount,
            absoluteReturnPercent: change.percentage,
            asOf: item.updatedAt || null,
            basis: 'Change between user-recorded invested amount and current-value snapshot; not time-weighted return.'
        };
    });

    holdings.forEach(item => {
        const category = item.category || 'Unspecified';
        categories.set(category, (categories.get(category) || 0) + numeric(item.currentValue));
    });

    const allocation = [...categories.entries()].map(([category, value]) => ({
        category,
        currentValue: round(value),
        percentage: currentValue > 0 ? round((value / currentValue) * 100) : 0
    }));

    const cashflows = transactions.flatMap(transaction => {
        const amount = numeric(transaction.amount);
        if (transaction.type === 'purchase' || transaction.type === 'sip') {
            return [{ amount: -amount, date: transaction.date }];
        }
        if (transaction.type === 'redemption' || transaction.type === 'dividend') {
            return [{ amount, date: transaction.date }];
        }
        return [];
    });
    if (currentValue > 0) cashflows.push({ amount: currentValue, date: asOf });

    const cagr = holdings.map(holding => {
        const holdingTransactions = transactions.filter(
            transaction => String(transaction.investmentId) === String(holding._id)
        );
        if (holdingTransactions.length !== 1 || holdingTransactions[0].type !== 'purchase') return null;
        return {
            percentage: calculateCagr({
            investedAmount: holdingTransactions[0].amount,
            currentValue: holding.currentValue,
            startDate: holdingTransactions[0].date,
            endDate: asOf
            }),
            currentValue: numeric(holding.currentValue)
        };
    });
    const realizedUnrealized = calculateRealizedUnrealized(holdings, transactions);

    return {
        asOf: new Date(asOf).toISOString(),
        holdingsCount: holdings.length,
        transactionCount: transactions.length,
        totalInvested,
        currentValue,
        absoluteReturn,
        holdingPerformance,
        xirrPercent: calculateXirr(cashflows),
        cagrPercent: cagr.length && cagr.every(value => value && value.percentage !== null)
            ? round(cagr.reduce((sum, item) => sum + item.percentage * item.currentValue, 0) /
                (currentValue || 1))
            : null,
        realizedUnrealized,
        allocation,
        concentration: weights,
        dataLimitations: [
            ...(transactions.length ? [] : ['No dated transaction ledger is available; XIRR and CAGR cannot be calculated.']),
            ...(cagr.length && cagr.some(value => value === null || value?.percentage === null)
                ? ['CAGR is unavailable for recurring or incomplete cash flows; use XIRR with a complete dated ledger instead.']
                : []),
            ...(!realizedUnrealized.available ? [realizedUnrealized.reason] : []),
            'NAV history, sector exposure, benchmark mapping, underlying holdings and expense ratios require verified fund-level source data.',
            'Current portfolio values are user-recorded snapshots and are not live NAV valuations.'
        ]
    };
};
