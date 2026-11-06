const DISCLAIMER = 'This is educational information, not personalized investment advice. Mutual-fund investments are market-linked and returns are not guaranteed.';
const normalize = value => String(value).toLowerCase().replace(/[’']/g, '').trim();

export const parseRisk = messages => {
    for (const message of [...messages].reverse()) {
        const text = normalize(message).replace(/-/g, ' ');
        if (/\b(conservative|low\s+risk|risk(?:\s+level)?\s*(?:is|of|:)?\s*low)\b/.test(text)) return 'low';
        if (/\b(moderate|medium\s+risk|risk(?:\s+level)?\s*(?:is|of|:)?\s*(?:medium|moderate))\b/.test(text)) return 'medium';
        if (/\b(aggressive|high\s+risk|risk(?:\s+level)?\s*(?:is|of|:)?\s*high)\b/.test(text)) return 'high';

        const simpleAnswer = text.match(/^(low|medium|moderate|high|conservative|aggressive)(?:\s+risk)?[.!]?$/);
        const briefAnswer = text.match(/(?:^|[,;]\s*)(low|medium|moderate|high)(?=\s*(?:[,;.!]|$))/);
        const answer = simpleAnswer?.[1] || briefAnswer?.[1];
        if (answer) return ['low', 'conservative'].includes(answer) ? 'low' :
            ['medium', 'moderate'].includes(answer) ? 'medium' : 'high';
    }
    return null;
};

export const parseHorizonYears = messages => {
    const text = normalize(messages.join(' '));
    const numeric = text.match(/\b(\d{1,2}(?:\.\d+)?)\s*(years?|yrs?|months?|mos?)\b/);
    if (numeric) {
        const value = Number(numeric[1]);
        return /month|mo/.test(numeric[2]) ? value / 12 : value;
    }

    const words = {
        one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
        eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
        fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
        nineteen: 19, twenty: 20, thirty: 30
    };
    const numberPattern = '(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty(?:[- ](?:one|two|three|four|five|six|seven|eight|nine))?|thirty(?:[- ](?:one|two|three|four|five|six|seven|eight|nine))?)';
    const written = text.match(new RegExp(`\\b${numberPattern}\\s+(years?|yrs?|months?|mos?)\\b`));
    if (!written) return null;
    const parts = written[1].split(/[- ]/);
    const value = parts.length === 2 ? words[parts[0]] + words[parts[1]] : words[parts[0]];
    return /month|mo/.test(written[2]) ? value / 12 : value;
};

const isRecommendationRequest = text =>
    /\b(recommend|recommendations?|suggest(?:ions?)?|which (?:mutual )?funds? (?:should i|would suit)|funds? should i|where should i invest|shortlist|pick a fund|best (?:mutual )?funds?|top funds?|highest returns|best performing|start investing|invest in mutual funds|want to invest|help me invest)\b/i.test(text);

const portfolioReply = (investments, userName) => {
    const invested = investments.reduce((sum, item) => sum + Number(item.investedAmount || 0), 0);
    const value = investments.reduce((sum, item) => sum + Number(item.currentValue || 0), 0);
    const change = value - invested;
    const changePercent = invested ? change / invested * 100 : null;
    const money = amount => new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
    }).format(amount);

    if (!investments.length) {
        return `Hi ${userName}, I don’t see any holdings recorded in your account yet. Import your actual statement values to start a portfolio review.`;
    }

    const asOf = investments
        .map(item => item.updatedAt)
        .filter(Boolean)
        .map(value => new Date(value))
        .sort((a, b) => b - a)[0];
    const holdings = investments
        .map(item => `• ${item.fundName}: ${money(Number(item.currentValue || 0))} recorded value`)
        .join('\n');

    return `Your recorded portfolio snapshot:\n• Invested: ${money(invested)}\n• Current value: ${money(value)}\n• Snapshot change: ${change >= 0 ? '+' : ''}${money(change)}${changePercent === null ? '' : ` (${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%)`}\n• Holdings: ${investments.length}\n${asOf ? `• Latest holding update: ${asOf.toISOString().slice(0, 10)}\n` : ''}\n${holdings}\n\nThese are account-recorded values, not verified live NAVs. A dated transaction history is needed for XIRR.`;
};

export const buildCfoReply = ({
    message,
    history = [],
    investments = [],
    userName = 'there'
}) => {
    const text = normalize(message);
    const userMessages = [...history.filter(item => item.role === 'user').map(item => item.content), message];
    const conversation = userMessages.join(' ');
    const disclaimer = `\n\n${DISCLAIMER}`;

    if (/^(hi|hello|hey|good morning|good afternoon|good evening)[!. ]*$/.test(text)) {
        return `Hi ${userName}! I can review your recorded portfolio, explain mutual-fund concepts, or research public fund data when the language-model provider is configured. For a fund shortlist, tell me your goal, investment horizon and risk comfort (low, medium or high).`;
    }

    if (/\b(?:otp|one[-\s]?time password|verification code)\b/i.test(text)) {
        return 'Never share an OTP with AI CFO. Enter it only on the official MF Central website or app; after downloading your statement, you can import its actual values here.';
    }

    if (/\b(?:mf[\s-]?central|cas statement|consolidated account statement|import (?:my )?(?:external )?(?:investments?|holdings|portfolio)|external (?:investments?|holdings))\b/i.test(text)) {
        return 'I can’t log in to MF Central or fetch your holdings automatically. Sign in on the official portal yourself, then import the actual statement values here; never share your OTP or password.';
    }

    if (/\b(xirr|internal rate of return|cagr|annualized return|sip performance|sip returns|compare.*last year|compare.*previous year|benchmark comparison|fund overlap)\b/i.test(text)) {
        return 'I cannot calculate this accurately because the required transaction or valuation data is unavailable. The built-in fallback cannot access your dated ledger or verified historical fund data.';
    }

    if (/\b(my portfolio|portfolio summary|portfolio value|how is my portfolio|my holdings|my funds|which funds do i hold|what funds do i hold|how much (?:have i )?invested|invested amount|current value|returns on my|my returns|portfolio returns|my profit|my loss|how am i doing)\b/i.test(text)) {
        return portfolioReply(investments, userName);
    }

    if (/\b(is (?:a )?switch(?:ing)? (?:free|charged)|(?:switch|transaction|platform) fees?|charges?|exit load|stamp duty)\b/i.test(text)) {
        return `I cannot confirm that a mutual-fund switch is free. It generally involves redemption and a fresh purchase, and exit load, tax, stamp duty and scheme expenses depend on the fund and your holding details; this app does not execute orders. LiveInvestments is an AMFI-registered distributor (ARN-300748) and may receive AMC commission where applicable; scheme-specific charges and commission disclosures must be checked before acting.`;
    }

    if (/\b(switch(?:ing)?|which fund should i replace)\b/i.test(text)) {
        return `I cannot determine a suitable fund to switch from a snapshot alone; I would need verified comparable performance, benchmark, risk, overlap, costs, your goal and time horizon. A switch generally involves redemption and a fresh purchase, so exit load, tax, stamp duty and scheme expenses may apply; the app does not execute switch orders. LiveInvestments is an AMFI-registered distributor (ARN-300748), not a SEBI-registered investment adviser, and may receive AMC commission where applicable; scheme-specific amounts are not available here.`;
    }

    if (/\b(should i|can i|how do i)\b.*\b(stop|pause|cancel)\b.*\b(sip|systematic investment)\b/i.test(text)) {
        return `Stopping a SIP generally stops future installments; it does not redeem units already invested. I cannot decide whether you should stop without your goal, time horizon and cash-flow needs, and this app does not change SIP mandates.`;
    }

    if (/\b(where|how|which platform)\b.*\b(track|monitor)\b.*\b(mutual funds?|portfolio|investments?)\b|\btrack all my mutual funds\b/i.test(text)) {
        return `LiveInvestments provides portfolio tracking and AI-powered analysis using the holdings and statement values available in your account. Tracking coverage depends on the data you provide; automatic portfolio synchronization is not available.`;
    }

    if (isRecommendationRequest(conversation)) {
        const risk = parseRisk(userMessages);
        const horizon = parseHorizonYears(userMessages);
        if (!risk) {
            return 'Before exploring fund categories, what is your investment goal, time horizon and risk comfort (low, medium or high)? Fund discovery is informational, not personalized investment advice.';
        }
        if (horizon === null) {
            return `Thanks for sharing your ${risk}-risk preference. What is your investment goal and investment horizon? Please share when you expect to need this money, in months or years.`;
        }
        return `I have your ${risk}-risk preference and ${horizon}-year horizon. Live fund research requires a configured language-model provider; I won’t recommend from an unverified local catalogue. No return is guaranteed.${disclaimer}`;
    }

    if (/\b(what is|explain|meaning of|how does|how do i start|how can i start|set up)\b.*\b(sip|systematic investment|nav|expense ratio|index fund|elss|debt fund|equity fund|exit load|direct plan|regular plan|dividend|growth option)\b/i.test(text) ||
        /\b(start|begin|set up)\s+(?:a\s+)?sip\b/i.test(text)) {
        if (/\b(sip|systematic investment)\b/i.test(text)) {
            return `A SIP (Systematic Investment Plan) invests an affordable amount at regular intervals, usually monthly. A SIP spreads purchases over time but does not remove market risk or guarantee returns. Use a regulated provider to set up actual payments.${disclaimer}`;
        }
        if (/\b(nav)\b/i.test(text)) {
            return `NAV (Net Asset Value) is the per-unit value of a mutual-fund scheme. A lower NAV does not mean a fund is cheaper or a better investment. Check the fund house or a verified market-data source for the latest NAV.${disclaimer}`;
        }
        if (/\b(expense ratio|direct plan|regular plan)\b/i.test(text)) {
            return `The expense ratio is an annual operating cost reflected in a mutual fund’s NAV. Direct and regular plans of the same scheme differ in distribution costs; check the latest official scheme documents before choosing.${disclaimer}`;
        }
        if (/\b(elss)\b/i.test(text)) {
            return `ELSS funds invest primarily in equities and have a statutory lock-in. Tax treatment depends on current law and your circumstances; verify current official rules or consult a tax professional.${disclaimer}`;
        }
        if (/\b(index fund)\b/i.test(text)) {
            return `An index fund aims to track a chosen market index. It carries market risk and can differ from its index because of tracking error and costs. Compare the index, tracking difference and current scheme documents.${disclaimer}`;
        }
        if (/\b(debt fund)\b/i.test(text)) {
            return `Debt mutual funds invest in fixed-income instruments. Interest-rate changes, credit events and liquidity can affect value; debt funds are not risk-free. Check the fund’s current portfolio and riskometer.${disclaimer}`;
        }
        if (/\b(equity fund)\b/i.test(text)) {
            return `Equity mutual funds invest in shares and can fluctuate significantly. They may suit some longer-term goals, but losses are possible and no time period guarantees a positive return.${disclaimer}`;
        }
        if (/\b(exit load)\b/i.test(text)) {
            return `An exit load is a charge that may apply when units are redeemed within a scheme’s specified period. Conditions vary by fund, so check the latest scheme information document.${disclaimer}`;
        }
        return `Growth and income-distribution options differ in how returns are handled. Distributions are not guaranteed; check the current scheme documents and tax treatment.${disclaimer}`;
    }

    if (/\b(mutual fund|mutual funds)\b/i.test(text) &&
        /\b(what is|how does|explain|meaning)\b/i.test(text)) {
        return `A mutual fund pools money from investors and invests it according to a scheme’s stated objective. Its value can rise or fall; returns are not guaranteed. Before investing, understand the scheme category, portfolio, costs, liquidity and current riskometer.${disclaimer}`;
    }

    if (/\b(tax|taxation|capital gains|tax saving)\b/i.test(text)) {
        return `Mutual-fund tax treatment depends on the fund type, purchase and sale dates, holding period and current law. I can explain general terms, but cannot confirm your personal tax liability. Check current official guidance or consult a tax professional.${disclaimer}`;
    }

    if (/\b(guarantee|guaranteed|sure profit|assured return|risk free)\b/i.test(text)) {
        return `Mutual funds do not guarantee returns, and market-linked funds are not risk-free. Be cautious of anyone promising assured profits.${disclaimer}`;
    }

    if (/\b(should i buy|should i sell|should i redeem|should i switch|buy or sell|sell or hold)\b/i.test(text)) {
        return `I can’t make a personal buy, sell, switch or redeem decision for you. Review your goal and timeline, the fund’s current factsheet and riskometer, costs and tax impact. For individualized advice, speak with a SEBI-registered investment adviser.${disclaimer}`;
    }

    return `I can help with your recorded portfolio and mutual-fund basics. For verified public fund research and agentic tool use, configure an AI provider in the server environment. I will not invent current NAVs, returns or fund details.${disclaimer}`;
};
