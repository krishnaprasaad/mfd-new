import assert from 'node:assert/strict';
import test from 'node:test';
import {
    analyzePortfolio,
    calculateAbsoluteReturn,
    calculateCagr,
    calculateRealizedUnrealized,
    calculateSipAnalysis,
    comparePortfolioSnapshot,
    calculateXirr
} from './portfolioAnalytics.js';

test('calculates absolute portfolio change from recorded values', () => {
    assert.deepEqual(calculateAbsoluteReturn(10000, 11500), {
        amount: 1500,
        percentage: 15
    });
    assert.equal(calculateAbsoluteReturn(0, 1000).percentage, null);
});

test('calculates CAGR only from a valid dated single investment amount', () => {
    const cagr = calculateCagr({
        investedAmount: 10000,
        currentValue: 12100,
        startDate: '2022-01-01',
        endDate: '2024-01-01'
    });
    assert.ok(cagr > 9.9 && cagr < 10.1);
    assert.equal(calculateCagr({
        investedAmount: 10000,
        currentValue: 12100,
        startDate: '2025-01-01',
        endDate: '2024-01-01'
    }), null);
});

test('calculates XIRR from dated outflow and inflow cash flows', () => {
    const xirr = calculateXirr([
        { amount: -10000, date: '2023-01-01' },
        { amount: 11000, date: '2024-01-01' }
    ]);
    assert.ok(xirr > 9.9 && xirr < 10.1);
    assert.equal(calculateXirr([{ amount: -100, date: '2023-01-01' }]), null);
});

test('portfolio analysis reports category weights and refuses to infer XIRR without a ledger', () => {
    const result = analyzePortfolio([
        { _id: 'one', fundName: 'Fund A', category: 'Equity', investedAmount: 1000, currentValue: 1200 },
        { _id: 'two', fundName: 'Fund B', category: 'Debt', investedAmount: 1000, currentValue: 800 }
    ], [], new Date('2024-01-01'));

    assert.equal(result.totalInvested, 2000);
    assert.equal(result.currentValue, 2000);
    assert.deepEqual(result.absoluteReturn, { amount: 0, percentage: 0 });
    assert.deepEqual(result.holdingPerformance[0], {
        fundName: 'Fund A',
        investedAmount: 1000,
        currentValue: 1200,
        absoluteReturnAmount: 200,
        absoluteReturnPercent: 20,
        asOf: null,
        basis: 'Change between user-recorded invested amount and current-value snapshot; not time-weighted return.'
    });
    assert.equal(result.xirrPercent, null);
    assert.equal(result.allocation.find(item => item.category === 'Equity').percentage, 60);
    assert.ok(result.dataLimitations.some(item => item.includes('No dated transaction ledger')));
});

test('portfolio XIRR combines dated transactions with terminal portfolio value', () => {
    const result = analyzePortfolio([
        { _id: 'one', fundName: 'Fund A', category: 'Equity', investedAmount: 1000, currentValue: 1100 }
    ], [
        { investmentId: 'one', type: 'purchase', amount: 1000, date: '2023-01-01' }
    ], new Date('2024-01-01'));

    assert.ok(result.xirrPercent > 9.9 && result.xirrPercent < 10.1);
    assert.ok(result.cagrPercent > 9.9 && result.cagrPercent < 10.1);
});

test('realized and unrealized gains use FIFO cost basis only when units and NAV are recorded', () => {
    const result = calculateRealizedUnrealized([
        { _id: 'one', currentValue: 600 }
    ], [
        { investmentId: 'one', type: 'purchase', amount: 1000, units: 100, nav: 10, date: '2023-01-01' },
        { investmentId: 'one', type: 'redemption', amount: 600, units: 50, nav: 12, date: '2024-01-01' }
    ]);

    assert.equal(result.available, true);
    assert.equal(result.realizedGain, 100);
    assert.equal(result.unrealizedGain, 100);
    assert.equal(calculateRealizedUnrealized([
        { _id: 'one', currentValue: 600 }
    ], [
        { investmentId: 'one', type: 'purchase', amount: 1000, date: '2023-01-01' }
    ]).available, false);
});

test('historical comparison requires a complete same-date snapshot of current holdings', () => {
    const holdings = [
        { _id: 'one', currentValue: 1200 },
        { _id: 'two', currentValue: 800 }
    ];
    const previousDate = '2023-01-01T00:00:00.000Z';
    const result = comparePortfolioSnapshot(holdings, [
        { investmentId: 'one', currentValue: 1000, asOfDate: previousDate },
        { investmentId: 'two', currentValue: 1000, asOfDate: previousDate }
    ], 1, new Date('2024-01-01T00:00:00.000Z'));

    assert.equal(result.available, true);
    assert.equal(result.previousValue, 2000);
    assert.equal(result.currentValue, 2000);
    assert.equal(result.changePercent, 0);
    assert.equal(comparePortfolioSnapshot(
        holdings,
        [{ investmentId: 'one', currentValue: 1000, asOfDate: previousDate }],
        1,
        new Date('2024-01-01T00:00:00.000Z')
    ).available, false);
});

test('SIP analysis uses recorded units and reports missing ledger data explicitly', () => {
    const result = calculateSipAnalysis([
        { _id: 'one', currentValue: 2200 }
    ], [
        { investmentId: 'one', type: 'sip', amount: 1000, units: 100, nav: 10, date: '2023-01-01' },
        { investmentId: 'one', type: 'sip', amount: 1000, units: 50, nav: 20, date: '2023-07-01' }
    ], new Date('2024-01-01'));

    assert.equal(result.available, true);
    assert.equal(result.totalContributions, 2000);
    assert.equal(result.valueFromRemainingSipUnits, 2200);
    assert.equal(result.absoluteGain, 200);
    assert.equal(calculateSipAnalysis([], []).available, false);
});
