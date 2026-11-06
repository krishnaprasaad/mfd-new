import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCfoReply, parseHorizonYears, parseRisk } from './cfoAssistant.js';

test('asks for risk first and then investment horizon before shortlisting', () => {
    const first = buildCfoReply({ message: 'Suggest mutual funds for me' });
    assert.match(first, /low, medium or high/i);

    const second = buildCfoReply({
        message: 'medium',
        history: [
            { role: 'user', content: 'Suggest mutual funds for me' },
            { role: 'assistant', content: first }
        ]
    });
    assert.match(second, /investment horizon/i);

    const third = buildCfoReply({
        message: '8 years',
        history: [
            { role: 'user', content: 'Suggest mutual funds for me' },
            { role: 'assistant', content: first },
            { role: 'user', content: 'medium' },
            { role: 'assistant', content: second }
        ]
    });
    assert.match(third, /Live fund research requires a configured/i);
    assert.doesNotMatch(third, /Mirae Asset|SBI Bluechip/);
});

test('does not suggest equity funds for a low-risk or short-horizon request', () => {
    const lowRisk = buildCfoReply({
        message: 'Suggest funds',
        history: [{ role: 'user', content: 'I prefer low risk and have a 10 year horizon.' }]
    });
    assert.match(lowRisk, /Live fund research requires a configured/i);

    const shortHorizon = buildCfoReply({
        message: 'Suggest funds for me',
        history: [{ role: 'user', content: 'I am comfortable with high risk for 2 years.' }]
    });
    assert.match(shortHorizon, /Live fund research requires a configured/i);
    assert.doesNotMatch(shortHorizon, /Parag Parikh|HDFC Flexi Cap/);
});

test('uses only the authenticated portfolio values for portfolio answers', () => {
    const reply = buildCfoReply({
        message: 'Summarize my portfolio',
        userName: 'Asha',
        investments: [
            { fundName: 'Fund A', investedAmount: 10000, currentValue: 12000 },
            { fundName: 'Fund B', investedAmount: 5000, currentValue: 4500 }
        ]
    });
    assert.match(reply, /₹15,000/);
    assert.match(reply, /₹16,500/);
    assert.match(reply, /10\.00%/);
    assert.match(reply, /not verified live NAVs/i);
});

test('explains common mutual-fund concepts without promising returns', () => {
    const reply = buildCfoReply({ message: 'Explain what a SIP is' });
    assert.match(reply, /Systematic Investment Plan/);
    assert.match(reply, /does not.*guarantee returns/i);
});

test('does not treat a fund name as verified live market data', () => {
    const reply = buildCfoReply({ message: 'Tell me about HDFC Flexi Cap Fund' });
    assert.match(reply, /configure an AI provider/i);
    assert.doesNotMatch(reply, /HDFC Flexi Cap Fund is listed/);
});

test('does not use a local mock catalogue to compare funds', () => {
    const reply = buildCfoReply({
        message: 'Compare HDFC Flexi Cap Fund and SBI Bluechip Fund'
    });
    assert.match(reply, /configure an AI provider/i);
    assert.doesNotMatch(reply, /41\.2|17\.4/);
});

test('does not tell the user to buy or sell a specific fund', () => {
    const reply = buildCfoReply({ message: 'Should I sell my mutual fund now?' });
    assert.match(reply, /can’t make a personal buy, sell/i);
    assert.match(reply, /SEBI-registered investment adviser/i);
});

test('fallback refuses to invent performance when dated portfolio records are unavailable', () => {
    const reply = buildCfoReply({ message: 'Calculate my XIRR' });
    assert.match(reply, /^I cannot calculate this accurately because the required transaction or valuation data is unavailable\./);
    assert.doesNotMatch(reply, /\b\d+(?:\.\d+)?%/);
    assert.match(buildCfoReply({ message: 'Compare my portfolio with last year' }), /^I cannot calculate this accurately/);
    assert.match(buildCfoReply({ message: 'What is my CAGR?' }), /^I cannot calculate this accurately/);
});

test('fallback explains switching costs and refuses to imply that orders are available', () => {
    const answer = buildCfoReply({ message: 'Is switching free?' });
    assert.match(answer, /cannot confirm.*free/i);
    assert.match(answer, /redemption and a fresh purchase/i);
    assert.match(answer, /does not execute orders/i);
    assert.match(answer, /may receive AMC commission/i);
});

test('fallback explains SIP cancellation without recommending or redeeming existing units', () => {
    const answer = buildCfoReply({ message: 'Should I stop my SIP?' });
    assert.match(answer, /stops future installments/i);
    assert.match(answer, /does not redeem units already invested/i);
    assert.match(answer, /cannot decide whether you should stop/i);
});

test('fallback requires objective, horizon, and risk before fund discovery', () => {
    const answer = buildCfoReply({ message: 'What is the best mutual fund?' });
    assert.match(answer, /investment goal, time horizon and risk comfort/i);
    assert.match(answer, /not personalized investment advice/i);
});

test('fallback guides MF Central imports without requesting credentials or OTPs', () => {
    const importReply = buildCfoReply({ message: 'Help me import my MF Central holdings' });
    assert.match(importReply, /can’t log in to MF Central or fetch your holdings automatically/i);
    assert.match(importReply, /official portal yourself/i);
    assert.match(importReply, /never share your OTP or password/i);

    const otpReply = buildCfoReply({ message: 'Should I send you my verification code?' });
    assert.match(otpReply, /Never share an OTP with AI CFO/i);
    assert.match(otpReply, /official MF Central website or app/i);
});

test('accepts risk and horizon provided together', () => {
    const reply = buildCfoReply({
        message: 'Suggest mutual funds. Medium risk, 8 years.'
    });
    assert.match(reply, /Live fund research requires a configured/i);
});

test('answers common mutual-fund and SIP questions', () => {
    const mutualFund = buildCfoReply({ message: 'What is a mutual fund?' });
    assert.match(mutualFund, /pools money from investors/i);

    const sip = buildCfoReply({ message: 'How do I start a SIP?' });
    assert.match(sip, /affordable amount/i);
    assert.match(sip, /does not.*guarantee returns/i);
});

test('parses supported risk levels and written investment horizons', () => {
    assert.equal(parseRisk(['My risk comfort is moderate.']), 'medium');
    assert.equal(parseRisk(['I am comfortable with high risk.']), 'high');
    assert.equal(parseRisk(['I prefer conservative investments.']), 'low');
    assert.equal(parseHorizonYears(['I need it in eighteen months.']), 1.5);
    assert.equal(parseHorizonYears(['My goal is five years away.']), 5);
});
