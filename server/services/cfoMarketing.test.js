import assert from 'node:assert/strict';
import test from 'node:test';
import {
    buildCfoConversionContext,
    classifyCfoIntent,
    getCfoContextualActions,
    requiresPublicResearch
} from './cfoMarketing.js';

test('switch request offers comparison only when research tools are actually available', () => {
    assert.deepEqual(buildCfoConversionContext('Which mutual funds should I switch?', [], {
        hasAi: true,
        hasPublicResearch: true
    }), {
        intent: 'fund_switching',
        actions: [{ id: 'compare_funds', label: 'Compare funds' }]
    });
    assert.deepEqual(buildCfoConversionContext('Which mutual funds should I switch?', [], {
        hasAi: false,
        hasPublicResearch: false
    }).actions, [{ id: 'get_investment_assistance', label: 'Get investment assistance' }]);
});

test('recommendation requests never surface a CTA before goal, horizon, and risk are supplied', () => {
    assert.equal(classifyCfoIntent('What is the best mutual fund?'), 'new_investment');
    assert.deepEqual(getCfoContextualActions('new_investment', {
        question: 'What is the best mutual fund?',
        hasPublicResearch: true
    }), []);
});

test('SIP questions and monthly investing are classified without creating an order action', () => {
    assert.equal(classifyCfoIntent('Should I stop my SIP?'), 'sip_investment');
    assert.equal(classifyCfoIntent('I want to invest ₹10,000 monthly'), 'sip_investment');
    assert.deepEqual(getCfoContextualActions('sip_investment', {
        question: 'I want to invest ₹10,000 monthly',
        hasPublicResearch: true
    }), []);
});

test('a complete user-provided investment profile can offer verified fund discovery', () => {
    const history = [
        { role: 'user', content: 'I want to invest 10000 monthly.' },
        { role: 'assistant', content: 'What are your goal, time horizon and risk comfort?' }
    ];
    const question = 'Retirement, 10 years, medium risk.';
    assert.equal(classifyCfoIntent(question, history), 'sip_investment');
    assert.deepEqual(getCfoContextualActions('sip_investment', { question, history }), [
        { id: 'explore_funds', label: 'Explore mutual funds' }
    ]);
});

test('portfolio improvement and overlap actions stay relevant to the question', () => {
    assert.equal(classifyCfoIntent('How can I improve my portfolio returns?'), 'portfolio_analysis');
    assert.deepEqual(getCfoContextualActions('portfolio_analysis', {
        question: 'How can I improve my portfolio returns?'
    }), [{ id: 'review_portfolio', label: 'View portfolio metrics' }]);
    assert.deepEqual(getCfoContextualActions('portfolio_analysis', {
        question: 'Find overlapping funds in my portfolio',
        hasAi: false,
        hasPublicResearch: false
    }), []);
});

test('switch charges do not produce unsupported free claims or transaction CTAs', () => {
    assert.equal(classifyCfoIntent('Is switching free?'), 'transaction_enquiry');
    assert.deepEqual(getCfoContextualActions('transaction_enquiry', {
        question: 'Is switching free?'
    }), []);
});

test('accepting a comparison offer continues the conversation without repeating the CTA', () => {
    const history = [
        { role: 'assistant', content: 'Would you like to compare these funds using verified public data?' }
    ];
    assert.equal(classifyCfoIntent('Yes, please compare these funds.', history), 'fund_comparison');
    assert.deepEqual(getCfoContextualActions('fund_comparison', {
        question: 'Yes, please compare these funds.',
        history,
        hasAi: true,
        hasPublicResearch: true
    }), []);
});

test('starting a switch can only offer assistance, never a transaction action', () => {
    const question = 'Please initiate a switch for my mutual fund.';
    const conversion = buildCfoConversionContext(question, [], {
        hasAi: false,
        hasPublicResearch: false
    });
    assert.equal(conversion.intent, 'fund_switching');
    assert.deepEqual(conversion.actions, [
        { id: 'get_investment_assistance', label: 'Get investment assistance' }
    ]);
    assert.equal(conversion.actions.some(item => /switch|sip|transaction/i.test(item.id)), false);
});

test('declining a suggested investment action produces no conversion CTA', () => {
    const history = [
        { role: 'assistant', content: 'Would you like to explore verified mutual-fund research?' }
    ];
    assert.equal(classifyCfoIntent('No thanks.', history), 'general_finance');
    assert.deepEqual(getCfoContextualActions('general_finance', {
        question: 'No thanks.',
        history,
        hasPublicResearch: true
    }), []);
});

test('platform tracking intent stays informational and does not create an order CTA', () => {
    const question = 'Where can I track all my mutual funds?';
    assert.equal(classifyCfoIntent(question), 'portfolio_tracking');
    assert.deepEqual(getCfoContextualActions('portfolio_tracking', { question }), []);
});

test('human assistance acceptance opens only the existing assistance workflow', () => {
    const history = [
        { role: 'assistant', content: 'Would you like to speak with our team for investment assistance?' }
    ];
    assert.deepEqual(getCfoContextualActions('transaction_enquiry', {
        question: 'Yes',
        history
    }), [{ id: 'get_investment_assistance', label: 'Request investment assistance' }]);
});

test('public MCP research is opened only for fund-specific research questions', () => {
    assert.equal(requiresPublicResearch('Hello'), false);
    assert.equal(requiresPublicResearch('How much is my portfolio worth?'), false);
    assert.equal(requiresPublicResearch('What is the latest NAV for this fund?'), true);
    assert.equal(requiresPublicResearch('Compare these mutual funds'), true);
    assert.equal(requiresPublicResearch('Find overlapping funds in my portfolio'), true);
    assert.equal(requiresPublicResearch('Show my sector exposure'), true);
    assert.equal(requiresPublicResearch('What is a SIP?'), false);
    assert.equal(requiresPublicResearch('Yes, compare them', [
        { role: 'assistant', content: 'Would you like to compare these funds using verified public data?' }
    ]), true);
});
