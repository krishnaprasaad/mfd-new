import assert from 'node:assert/strict';
import test from 'node:test';
import { createPortfolioTools, getPortfolioData } from './cfoTools.js';

const makeQuery = (result, onFilter) => ({
    lean: async () => {
        onFilter();
        return result;
    }
});

test('portfolio tools always scope both holdings and transactions to the authenticated user', async () => {
    const ownerId = 'authenticated-owner';
    const observedFilters = [];
    const InvestmentModel = {
        find: filter => {
            observedFilters.push(filter);
            return makeQuery([], () => {});
        }
    };
    const TransactionModel = {
        find: filter => {
            observedFilters.push(filter);
            return {
                sort() {
                    return makeQuery([], () => {});
                }
            };
        }
    };
    const tools = createPortfolioTools(ownerId, { InvestmentModel, TransactionModel });
    const summaryTool = tools.find(item => item.name === 'get_portfolio_summary');
    await summaryTool.invoke({ userId: 'attacker-selected-id' });

    assert.equal(observedFilters.length, 2);
    assert.ok(observedFilters.every(filter => filter.userId === ownerId));
    assert.ok(tools.every(item => !('userId' in item.schema.shape)));
});

test('portfolio data loader scopes every model query to its authenticated owner', async () => {
    const ownerId = 'second-owner';
    const observedFilters = [];
    const InvestmentModel = {
        find: filter => {
            observedFilters.push(filter);
            return makeQuery([], () => {});
        }
    };
    const TransactionModel = {
        find: filter => {
            observedFilters.push(filter);
            return {
                sort() {
                    return makeQuery([], () => {});
                }
            };
        }
    };

    const result = await getPortfolioData(ownerId, InvestmentModel, TransactionModel);
    assert.deepEqual(result, { holdings: [], transactions: [] });
    assert.ok(observedFilters.every(filter => filter.userId === ownerId));
});

test('XIRR can be scoped to one exact authenticated holding', async () => {
    const holdings = [
        { _id: 'fund-a', fundName: 'Fund A', currentValue: 12000 },
        { _id: 'fund-b', fundName: 'Fund B', currentValue: 90000 }
    ];
    const transactions = [
        { investmentId: 'fund-a', type: 'purchase', amount: 10000, date: new Date('2024-01-01') },
        { investmentId: 'fund-b', type: 'purchase', amount: 80000, date: new Date('2024-01-01') }
    ];
    const InvestmentModel = { find: () => makeQuery(holdings, () => {}) };
    const TransactionModel = {
        find: () => ({
            sort() {
                return makeQuery(transactions, () => {});
            }
        })
    };
    const tools = createPortfolioTools('authenticated-owner', {
        InvestmentModel,
        TransactionModel,
        now: () => new Date('2025-01-01')
    });

    const result = JSON.parse(await tools.find(item => item.name === 'calculate_xirr')
        .invoke({ fundName: 'Fund A' }));

    assert.equal(result.fundName, 'Fund A');
    assert.equal(result.available, true);
    assert.ok(result.xirrPercent > 0);
});

test('SIP analysis filters transactions to the explicitly selected holding', async () => {
    const holdings = [{ _id: 'fund-a', fundName: 'Fund A', currentValue: 12000 }];
    const transactions = [{
        investmentId: 'fund-a',
        type: 'sip',
        amount: 10000,
        units: 100,
        nav: 100,
        date: new Date('2024-01-01')
    }];
    let transactionFilter;
    const InvestmentModel = { find: () => makeQuery(holdings, () => {}) };
    const TransactionModel = {
        find: filter => {
            transactionFilter = filter;
            return { sort() { return makeQuery(transactions, () => {}); } };
        }
    };
    const tools = createPortfolioTools('authenticated-owner', {
        InvestmentModel,
        TransactionModel
    });
    const result = JSON.parse(await tools.find(item => item.name === 'get_sip_analysis')
        .invoke({ fundName: 'Fund A' }));

    assert.deepEqual(transactionFilter, {
        userId: 'authenticated-owner',
        investmentId: { $in: ['fund-a'] }
    });
    assert.equal(result.available, true);
});

test('projection tool accepts zero contributions and compounds the current portfolio value', async () => {
    const tools = createPortfolioTools('authenticated-owner', {
        InvestmentModel: { find: () => makeQuery([], () => {}) },
        TransactionModel: { find: () => ({ sort() { return makeQuery([], () => {}); } }) }
    });
    const result = JSON.parse(await tools.find(item => item.name === 'project_monthly_investment')
        .invoke({
            monthlyContribution: 0,
            years: 10,
            annualRatePercent: 10,
            initialInvestment: 100000
        }));

    assert.equal(result.assumedMonthlyContribution, 0);
    assert.equal(result.initialInvestment, 100000);
    assert.equal(result.totalContributions, 0);
    assert.equal(result.projectedValue, 259374.25);
});
