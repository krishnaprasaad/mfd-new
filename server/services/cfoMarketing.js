const intentPatterns = [
    ['transaction_enquiry', /\b(free|fee|fees|charges?|exit load|tax(?:ation)?|stamp duty|commission|cost of (?:switch|invest)|is (?:a )?switch(?:ing)? (?:free|charged))\b/i],
    ['fund_switching', /\b(switch(?:ing)?|move (?:my )?investment|transfer (?:my )?fund|redeem .* (?:buy|purchase))\b/i],
    ['fund_comparison', /\b(compare|comparison|versus|vs\.?)\b.*\b(funds?|schemes?|mutual funds?)\b|\b(funds?|schemes?)\b.*\b(compare|comparison|versus|vs\.?)\b/i],
    ['sip_investment', /\b(sip|systematic investment|monthly investment|monthly contribution|stop .*sip|pause .*sip|cancel .*sip)\b|\b(monthly|per month|each month)\b.*\b(invest|contribute)\b|\b(invest|contribute)\b.*\b(monthly|per month|each month)\b/i],
    ['portfolio_tracking', /\b(track|tracking|monitor|monitoring|where .* (?:see|view|track))\b.*\b(portfolio|mutual funds?|investments?)\b|\b(portfolio|mutual funds?|investments?)\b.*\b(track|tracking|monitor|monitoring)\b/i],
    ['financial_planning', /\b(financial plan|plan for|planning|financial goal|reach (?:₹|rs\.?\s*)?[\d,]+|retirement plan|goal planning|how much should i invest)\b/i],
    ['new_investment', /\b(best (?:mutual )?fund|which (?:mutual )?funds?|start investing|start a? ?sip|begin investing|invest (?:in|₹|rs\.?)|new investment|investing ₹?[\d,]+|how (?:can|should|do) i invest|help me invest)\b/i],
    ['portfolio_analysis', /\b(portfolio|holdings|overlap|diversif(?:y|ied|ication)|allocation|returns?|performance|improve|exposure)\b/i]
];

const userMessages = history => history.filter(message => message.role === 'user').map(message => message.content);
const assistantMessages = history => history.filter(message => message.role === 'assistant').map(message => message.content);
const isAcceptance = text => /^(?:(?:yes|yeah|yep|sure|okay|ok)(?:[, ]+please)?(?:[, ]+(?:compare\b.*|do so|do it|go ahead|let'?s do it))?|please do|go ahead|sounds good|compare them|let'?s do it)[!. ]*$/i.test(text.trim());
const isDecline = text => /^(no|no thanks|not now|maybe later|skip|i decline|don'?t|do not)[!. ]*$/i.test(text.trim());

const hasInvestmentProfile = messages => {
    const text = messages.join(' ');
    const hasRisk = /\b(low|medium|moderate|high|conservative|aggressive)\s+risk\b|\b(risk (?:level|tolerance|appetite) (?:is )?(?:low|medium|moderate|high))\b/i.test(text);
    const hasHorizon = /\b\d{1,2}(?:\.\d+)?\s*(?:years?|yrs?|months?|mos?)\b/i.test(text);
    const hasGoal = /\b(retire(?:ment)?|education|home|house|wedding|emergency|wealth|goal|travel|medical|child|children)\b/i.test(text);
    return hasRisk && hasHorizon && hasGoal;
};

const action = (id, label) => ({ id, label });

export const classifyCfoIntent = (question, history = []) => {
    const text = String(question || '').trim();
    if (isDecline(text)) return 'general_finance';

    if (isAcceptance(text)) {
        const previousAssistant = assistantMessages(history).at(-1) || '';
        if (/\b(compare|comparison)\b/i.test(previousAssistant)) return 'fund_comparison';
        if (/\b(assistance|speak with|meeting|discuss with)\b/i.test(previousAssistant)) return 'transaction_enquiry';
    }

    for (const [intent, pattern] of intentPatterns) {
        if (pattern.test(text)) return intent;
    }

    const profileAnswer = /\b(?:low|medium|moderate|high|conservative|aggressive)\s+risk\b|\b\d{1,2}(?:\.\d+)?\s*(?:years?|yrs?|months?|mos?)\b/i.test(text);
    if (profileAnswer) {
        const prior = userMessages(history).slice(-4).join(' ');
        if (/\b(sip|monthly|invest|fund|goal|mutual)\b/i.test(prior)) {
            return /\b(sip|monthly)\b/i.test(prior) ? 'sip_investment' : 'new_investment';
        }
    }

    return 'general_finance';
};

export const getCfoContextualActions = (
    intent,
    { question = '', history = [], hasAi = false, hasPublicResearch = false } = {}
) => {
    const messages = [...userMessages(history), question];
    if (isDecline(question)) return [];
    if (isAcceptance(question)) {
        const previousAssistant = assistantMessages(history).at(-1) || '';
        return /\b(would you like|would you prefer|like to|want to)\b.*\b(assistance|speak|meeting|discuss)\b/i.test(previousAssistant)
            ? [action('get_investment_assistance', 'Request investment assistance')]
            : [];
    }

    if (intent === 'portfolio_analysis') {
        if (/\b(overlap|overlapping|same holdings)\b/i.test(question)) {
            return hasAi && hasPublicResearch
                ? [action('compare_funds', 'Compare funds')]
                : [];
        }
        return [action('review_portfolio', 'View portfolio metrics')];
    }
    if (intent === 'fund_switching') {
        return hasAi && hasPublicResearch
            ? [action('compare_funds', 'Compare funds')]
            : [action('get_investment_assistance', 'Get investment assistance')];
    }
    if (intent === 'fund_comparison') {
        return hasAi && hasPublicResearch
            ? [action('compare_funds', 'Ask AI to compare')]
            : [action('explore_funds', 'Explore verified funds')];
    }
    if (intent === 'new_investment' || intent === 'sip_investment') {
        if (!hasInvestmentProfile(messages)) return [];
        return [action('explore_funds', 'Explore mutual funds')];
    }
    if (intent === 'financial_planning') return [action('get_investment_assistance', 'Get investment assistance')];
    if (intent === 'transaction_enquiry' &&
        /\b(start|initiat(?:e|ing)|place|execute|process|how (?:can|do) i (?:switch|invest|set up)|switch .* (?:online|through|via))\b/i.test(question)) {
        return [action('get_investment_assistance', 'Discuss the process')];
    }
    return [];
};

export const buildCfoConversionContext = (question, history = [], capabilities = {}) => {
    const intent = classifyCfoIntent(question, history);
    return {
        intent,
        actions: getCfoContextualActions(intent, { question, history, ...capabilities })
    };
};
