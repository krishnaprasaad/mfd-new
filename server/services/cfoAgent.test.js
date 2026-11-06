import assert from 'node:assert/strict';
import test from 'node:test';
import { FakeListChatModel } from '@langchain/core/utils/testing';
import { createAgent } from 'langchain';
import {
    buildCfoSystemPrompt,
    getCfoFailureMessage,
    getConfiguredProvider,
    inferRequiredCfoToolPlan,
    isCfoProviderError,
    isSafeBuiltinFallbackQuestion,
    streamCfoAnswer
} from './cfoAgent.js';

const routingCases = [
    ['Analyse my portfolio', 'get_portfolio_summary'],
    ['How is my portfolio performing?', 'get_portfolio_summary'],
    ['What is my total return?', 'get_portfolio_summary'],
    ['Calculate my CAGR', 'get_portfolio_summary'],
    ['Calculate my XIRR', 'calculate_xirr'],
    ['What is its XIRR?', 'calculate_xirr'],
    ['Show my asset allocation', 'get_asset_allocation'],
    ['How much of my portfolio is in mid-cap?', 'get_asset_allocation'],
    ['What are the major risks in my portfolio?', 'analyze_portfolio_risk'],
    ['Am I diversified?', 'analyze_portfolio_risk'],
    ['Is my portfolio concentrated?', 'analyze_portfolio_risk'],
    ['Find overlapping funds in my portfolio', 'analyze_client_fund_overlap'],
    ['Review my SIP performance', 'get_sip_analysis'],
    ['What is my SIP XIRR?', 'get_sip_analysis'],
    ['Compare my portfolio with last year', 'compare_portfolio_with_past'],
    ['How did my portfolio change 3 years ago?', 'compare_portfolio_with_past'],
    ['Show my sector allocation', 'get_client_sector_allocation'],
    ['Show my transaction history', 'get_transaction_history'],
    ['What if I invest ₹10,000 monthly for 10 years at 12%?', 'project_monthly_investment'],
    ['How much should I invest monthly to reach one crore?', null],
    ['Compare my fund with its benchmark', null],
    ['Compare the overlap between Fund A and Fund B', null],
    ['What is the latest NAV for this fund?', null],
    ['What is the weather tomorrow?', null]
];

test(`financial question routing matches the offline ${routingCases.length}-question matrix`, () => {
    const outcomes = routingCases.map(([question, expected]) => ({
        question,
        expected,
        actual: inferRequiredCfoToolPlan(question)?.name || null
    }));
    const correct = outcomes.filter(item => item.actual === item.expected).length;
    const accuracy = correct / outcomes.length;

    assert.equal(correct, outcomes.length, JSON.stringify(outcomes.filter(item => item.actual !== item.expected)));
    assert.equal(accuracy, 1);
    assert.deepEqual(inferRequiredCfoToolPlan('What if I invest 10,000 monthly for 10 years?'), null);
});

test('analyst prompt defines concise responses, tool use, unavailable data, and follow-up resolution', () => {
    const prompt = buildCfoSystemPrompt({ userName: 'Test Investor', hasPublicResearch: false });
    assert.match(prompt, /2–6 concise sentences/);
    assert.match(prompt, /call the most relevant deterministic portfolio tool/);
    assert.match(prompt, /I cannot calculate this accurately because the required transaction or valuation data is unavailable/);
    assert.match(prompt, /resolve "it", "that fund", "the second one"/);
    assert.match(prompt, /Verified public-fund research is unavailable/);
    assert.match(prompt, /not a SEBI-registered investment adviser/);
    assert.match(prompt, /does not place, redeem, or switch mutual-fund orders/);
    assert.match(prompt, /may receive AMC commission where applicable/);
    assert.match(prompt, /a switch cannot be assumed free/);
    assert.match(prompt, /Never append a generic greeting or open-ended sign-off/);
    assert.match(prompt, /no connected stock portfolio/);
    assert.match(prompt, /structured saved-goals record/);
    assert.match(prompt, /only if the user stated it in this conversation/);
    assert.match(prompt, /distinguish the source's observation date from the time it was retrieved/);
});

test('switch and SIP stop questions preflight authenticated portfolio tools', () => {
    assert.equal(inferRequiredCfoToolPlan('Which funds should I switch?')?.name, 'get_portfolio_summary');
    assert.equal(inferRequiredCfoToolPlan('Should I stop my SIP?')?.name, 'get_sip_analysis');
});

test('projection follow-up resolves the earlier horizon, return, and explicit zero monthly contribution', () => {
    const history = [
        { role: 'user', content: 'What will my portfolio be worth after 10yrs?' },
        { role: 'assistant', content: 'What annual return and monthly contribution should I assume?' },
        { role: 'user', content: '10% return' },
        { role: 'assistant', content: 'How much will you add as a monthly contribution? Reply 0 for none.' }
    ];
    assert.deepEqual(inferRequiredCfoToolPlan('10% return and 0 investment', history), {
        name: 'project_monthly_investment',
        args: {
            monthlyContribution: 0,
            years: 10,
            annualRatePercent: 10,
            initialInvestment: 0
        },
        requiresPortfolioSummary: true
    });
});

test('provider failures fall back only for safe, non-market educational questions', () => {
    assert.equal(isCfoProviderError({ status: 429 }), true);
    assert.equal(isCfoProviderError({ code: 'ETIMEDOUT' }), true);
    assert.equal(isCfoProviderError(new Error('database tool failed')), false);
    assert.equal(isSafeBuiltinFallbackQuestion('What is a SIP?'), true);
    assert.equal(isSafeBuiltinFallbackQuestion('What is my portfolio XIRR?'), false);
    assert.equal(isSafeBuiltinFallbackQuestion('Compare these funds'), false);
    assert.equal(isSafeBuiltinFallbackQuestion('Is switching free?'), true);
    assert.equal(isSafeBuiltinFallbackQuestion('Should I stop my SIP?'), true);
});

test('follow-up fund references resolve to the prior named holding before XIRR retrieval', async () => {
    let selectedFund;
    let capturedInput;
    const tools = [
        {
            name: 'get_client_portfolio',
            invoke: async () => JSON.stringify([
                { fundName: 'Alpha Equity Fund' },
                { fundName: 'Beta Balanced Fund' }
            ])
        },
        {
            name: 'calculate_xirr',
            invoke: async args => {
                selectedFund = args.fundName;
                return JSON.stringify({ available: false, fundName: args.fundName });
            }
        }
    ];
    const agent = {
        async *streamEvents(input) {
            capturedInput = input;
            yield {
                event: 'on_chat_model_stream',
                data: { chunk: { content: 'I cannot calculate this accurately because the required transaction or valuation data is unavailable.' } }
            };
        }
    };
    const events = [];
    await streamCfoAnswer({
        agent,
        tools,
        history: [
            { role: 'user', content: 'Which of these is more stable, Alpha Equity Fund or Beta Balanced Fund?' },
            { role: 'assistant', content: 'Beta Balanced Fund is less volatile based on the stated comparison.' }
        ],
        question: 'What is its XIRR?',
        onEvent: event => events.push(event)
    });

    assert.equal(selectedFund, 'Beta Balanced Fund');
    assert.equal(capturedInput.messages.at(-2).type, 'system');
    assert.match(capturedInput.messages.at(-2).content, /"available":false/);
    assert.deepEqual(events.filter(event => event.type === 'tool').map(event => event.state), [
        'running', 'complete', 'running', 'complete'
    ]);
});

test('unresolved fund follow-up does not substitute whole-portfolio XIRR', async () => {
    let xirrInvoked = false;
    let capturedInput;
    const tools = [
        { name: 'get_client_portfolio', invoke: async () => JSON.stringify([{ fundName: 'Fund A' }]) },
        { name: 'calculate_xirr', invoke: async () => { xirrInvoked = true; return '{"xirrPercent":10}'; } }
    ];
    const agent = {
        async *streamEvents(input) {
            capturedInput = input;
            yield { event: 'on_chat_model_stream', data: { chunk: { content: 'Which fund do you mean?' } } };
        }
    };

    await streamCfoAnswer({
        agent,
        tools,
        history: [{ role: 'assistant', content: 'Your portfolio is recorded.' }],
        question: 'What is its XIRR?',
        onEvent: () => {}
    });

    assert.equal(xirrInvoked, false);
    assert.match(capturedInput.messages.at(-2).content, /ask the user which exact holding/);
});

test('Groq defaults to its currently recommended replacement model', () => {
    const keys = ['AI_PROVIDER', 'AI_MODEL', 'AI_API_KEY', 'GROQ_API_KEY', 'AI_BASE_URL'];
    const previous = new Map(keys.map(key => [key, process.env[key]]));
    try {
        process.env.AI_PROVIDER = 'groq';
        process.env.GROQ_API_KEY = 'test-key';
        delete process.env.AI_MODEL;
        delete process.env.AI_API_KEY;
        delete process.env.AI_BASE_URL;

        assert.deepEqual(getConfiguredProvider(), {
            name: 'groq',
            model: 'openai/gpt-oss-120b'
        });
    } finally {
        for (const [key, value] of previous) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
    }
});

test('Groq API key selects the configured Groq model when provider is not explicitly set', () => {
    const keys = ['AI_PROVIDER', 'AI_MODEL', 'AI_API_KEY', 'GROQ_API_KEY', 'AI_BASE_URL'];
    const previous = new Map(keys.map(key => [key, process.env[key]]));
    try {
        delete process.env.AI_PROVIDER;
        process.env.AI_MODEL = 'openai/gpt-oss-120b';
        process.env.GROQ_API_KEY = 'test-key';
        delete process.env.AI_API_KEY;
        delete process.env.AI_BASE_URL;

        assert.deepEqual(getConfiguredProvider(), {
            name: 'groq',
            model: 'openai/gpt-oss-120b'
        });
    } finally {
        for (const [key, value] of previous) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
    }
});

test('LangChain agent streams answer tokens through the CFO event adapter', async () => {
    const agent = createAgent({
        model: new FakeListChatModel({ responses: ['Portfolio is ready.'] }),
        tools: [],
        prompt: 'Return a concise answer.'
    });
    const events = [];
    const reply = await streamCfoAnswer({
        agent,
        history: [],
        question: 'Summarize my portfolio',
        onEvent: event => events.push(event)
    });

    assert.equal(reply, 'Portfolio is ready.');
    assert.equal(events.filter(event => event.type === 'token').map(event => event.text).join(''), reply);
});

test('removes repeated generic investment greetings before and after the streamed answer', async () => {
    const rawAnswer = 'Hello! How can I assist you with your investments today? ' +
        'Your recorded portfolio data is available for review. '.repeat(3) +
        'Hello! How can I assist you with your investments today?';
    const agent = {
        async *streamEvents() {
            for (let index = 0; index < rawAnswer.length; index += 13) {
                yield {
                    event: 'on_chat_model_stream',
                    data: { chunk: { content: rawAnswer.slice(index, index + 13) } }
                };
            }
        }
    };
    const events = [];
    const reply = await streamCfoAnswer({
        agent,
        history: [],
        question: 'Review my recorded portfolio',
        onEvent: event => events.push(event)
    });

    assert.equal(reply, 'Your recorded portfolio data is available for review. '.repeat(3).trimEnd());
    assert.equal(events.filter(event => event.type === 'token').map(event => event.text).join(''), reply);
    assert.doesNotMatch(reply, /Hello! How can I assist you with your investments today/i);
});

test('uses the final agent answer instead of concatenating intermediate model text', async () => {
    const interim = 'I’m doing great, thank you! How can I help you with your portfolio?';
    const answer = 'Your recorded portfolio snapshot shows a gain of ₹24,200.';
    const agent = {
        async *streamEvents() {
            yield {
                event: 'on_chat_model_stream',
                data: { chunk: { content: interim } }
            };
            yield {
                event: 'on_chat_model_stream',
                data: { chunk: { content: answer } }
            };
            yield {
                event: 'on_chain_end',
                data: { output: { messages: [{ type: 'ai', content: answer }] } }
            };
        }
    };
    const events = [];
    const reply = await streamCfoAnswer({
        agent,
        history: [],
        question: 'How much is my profit?',
        onEvent: event => events.push(event)
    });

    assert.equal(reply, answer);
    assert.equal(events.filter(event => event.type === 'token').map(event => event.text).join(''), answer);
    assert.doesNotMatch(reply, /I’m doing great/);
});

test('portfolio projection preflight includes current value and accepts zero monthly contributions', async () => {
    let projectionArgs;
    let capturedInput;
    const tools = [
        {
            name: 'get_portfolio_summary',
            invoke: async () => JSON.stringify({ currentValue: 100000, asOf: '2026-11-05T00:00:00.000Z' })
        },
        {
            name: 'project_monthly_investment',
            invoke: async args => {
                projectionArgs = args;
                return JSON.stringify({ projectedValue: 259374.25, years: 10 });
            }
        }
    ];
    const agent = {
        async *streamEvents(input) {
            capturedInput = input;
            yield {
                event: 'on_chat_model_stream',
                data: { chunk: { content: 'At the stated illustrative rate, your portfolio projection is available.' } }
            };
        }
    };
    const history = [
        { role: 'user', content: 'What will my portfolio be worth after 10yrs?' },
        { role: 'assistant', content: 'What annual return and monthly contribution should I assume?' },
        { role: 'user', content: '10% return' },
        { role: 'assistant', content: 'How much will you add as a monthly contribution? Reply 0 for none.' }
    ];
    const events = [];
    await streamCfoAnswer({
        agent,
        tools,
        history,
        question: '10% return and 0 investment',
        onEvent: event => events.push(event)
    });

    assert.deepEqual(projectionArgs, {
        monthlyContribution: 0,
        years: 10,
        annualRatePercent: 10,
        initialInvestment: 100000
    });
    assert.ok(capturedInput.messages.some(message => /"currentValue":100000/.test(message.content)));
    assert.ok(capturedInput.messages.some(message => /"projectedValue":259374.25/.test(message.content)));
    assert.deepEqual(events.filter(event => event.type === 'tool').map(event => event.state), [
        'running', 'complete', 'running', 'complete'
    ]);
});

test('simple factual answer remains relevant and within the concise response target', async () => {
    const answer = 'Your recorded current value is ₹12,000. This figure is from your latest saved snapshot.';
    const agent = {
        async *streamEvents() {
            yield { event: 'on_chat_model_stream', data: { chunk: { content: answer } } };
        }
    };
    const reply = await streamCfoAnswer({
        agent,
        history: [],
        question: 'What is my recorded current value?',
        onEvent: () => {}
    });
    const sentenceCount = (reply.match(/[.!?](?:\s|$)/g) || []).length;

    assert.match(reply, /recorded current value is ₹12,000/);
    assert.ok(sentenceCount <= 3, `Expected a simple factual answer, got ${sentenceCount} sentences.`);
});

test('CFO provider failures explain credential, quota, model and network errors safely', () => {
    assert.match(getCfoFailureMessage({ status: 401 }), /rejected its API credentials/);
    assert.match(getCfoFailureMessage({ response: { status: 429 } }), /no available quota/);
    assert.match(getCfoFailureMessage({ cause: { status: 404 } }), /AI_MODEL/);
    assert.match(getCfoFailureMessage({ code: 'ETIMEDOUT' }), /could not connect/);
    assert.match(getCfoFailureMessage(new Error('private upstream details')), /could not complete this request/);
});
