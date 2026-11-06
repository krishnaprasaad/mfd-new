// Removed mock database import
import { containsOtpSecret } from './src/cfoInputSafety.js';

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const landingView = document.getElementById('landing-view');
    const dashboardView = document.getElementById('dashboard-view');
    const loginModal = document.getElementById('login-modal');

    const navLoginBtn = document.getElementById('nav-login-btn');
    const navGetStartedBtn = document.getElementById('nav-get-started-btn');
    const navLogoutBtn = document.getElementById('nav-logout-btn');
    const modalCloseBtn = document.getElementById('modal-close-btn');

    const loginForm = document.getElementById('login-form');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const loginError = document.getElementById('login-error');

    const signupForm = document.getElementById('signup-form');
    const signupError = document.getElementById('signup-error');
    const signupSuccess = document.getElementById('signup-success');

    // Dashboard Elements
    const userNameDisplay = document.getElementById('user-name-display');
    const totalInvestedEl = document.getElementById('total-invested');
    const currentValueEl = document.getElementById('current-value');
    const totalReturnsEl = document.getElementById('total-returns');
    const returnsPercentageEl = document.getElementById('returns-percentage');
    const investmentsTbody = document.getElementById('investments-tbody');

    // Dashboard Tabs Elements
    const tabPortfolio = document.getElementById('tab-portfolio');
    const tabCfo = document.getElementById('tab-cfo');
    const tabExplore = document.getElementById('tab-explore');
    const portfolioSection = document.getElementById('portfolio-section');
    const cfoSection = document.getElementById('cfo-section');
    const exploreSection = document.getElementById('explore-funds-section');
    const exploreFundsGrid = document.getElementById('explore-funds-grid');
    const exploreFundsSearchForm = document.getElementById('explore-funds-search-form');
    const exploreFundsSearch = document.getElementById('explore-funds-search');

    // --- State ---
    let currentUser = null;
    let currentPortfolio = null;

    // --- Utility Functions ---
    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(amount);
    };

    const formatPercentage = (percent) => {
        return (percent > 0 ? '+' : '') + percent.toFixed(2) + '%';
    };

    const cfoChatHistory = [];
    let cfoExecutionStartedAt = 0;
    let cfoExecutionTimer = null;
    let cfoConversationTitle = '';

    const escapeCfoHtml = value => String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const formatCfoInlineMarkdown = value => escapeCfoHtml(value)
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>')
        .replace(/\[([^\]]+)\]\((https:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    const renderCfoMarkdown = (element, markdown) => {
        element.replaceChildren();
        const lines = String(markdown).replace(/\r/g, '').split('\n');
        let index = 0;
        const appendParagraph = text => {
            const paragraph = document.createElement('p');
            paragraph.innerHTML = formatCfoInlineMarkdown(text);
            element.appendChild(paragraph);
        };
        const isTableRule = line => /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
        const cells = line => line.trim().replace(/^\||\|$/g, '').split('|').map(cell => cell.trim());

        while (index < lines.length) {
            const line = lines[index];
            if (!line.trim()) {
                index++;
                continue;
            }
            if (line.trim().startsWith('```')) {
                index++;
                const code = [];
                while (index < lines.length && !lines[index].trim().startsWith('```')) code.push(lines[index++]);
                index++;
                const pre = document.createElement('pre');
                const codeElement = document.createElement('code');
                codeElement.textContent = code.join('\n');
                pre.appendChild(codeElement);
                element.appendChild(pre);
                continue;
            }
            if (index + 1 < lines.length && line.includes('|') && isTableRule(lines[index + 1])) {
                const table = document.createElement('table');
                table.className = 'cfo-markdown-table';
                const thead = document.createElement('thead');
                const headerRow = document.createElement('tr');
                cells(line).forEach(value => {
                    const th = document.createElement('th');
                    th.innerHTML = formatCfoInlineMarkdown(value);
                    headerRow.appendChild(th);
                });
                thead.appendChild(headerRow);
                table.appendChild(thead);
                index += 2;
                const tbody = document.createElement('tbody');
                while (index < lines.length && lines[index].includes('|') && lines[index].trim()) {
                    const tr = document.createElement('tr');
                    cells(lines[index++]).forEach(value => {
                        const td = document.createElement('td');
                        td.innerHTML = formatCfoInlineMarkdown(value);
                        tr.appendChild(td);
                    });
                    tbody.appendChild(tr);
                }
                table.appendChild(tbody);
                const wrap = document.createElement('div');
                wrap.className = 'cfo-markdown-table-wrap';
                wrap.appendChild(table);
                element.appendChild(wrap);
                continue;
            }
            const heading = line.match(/^(#{1,4})\s+(.+)$/);
            if (heading) {
                const title = document.createElement(`h${Math.min(heading[1].length + 2, 6)}`);
                title.innerHTML = formatCfoInlineMarkdown(heading[2]);
                element.appendChild(title);
                index++;
                continue;
            }
            if (/^\s*[-*]\s+/.test(line) || /^\s*\d+[.)]\s+/.test(line)) {
                const ordered = /^\s*\d+[.)]\s+/.test(line);
                const list = document.createElement(ordered ? 'ol' : 'ul');
                while (index < lines.length && (ordered
                    ? /^\s*\d+[.)]\s+/.test(lines[index])
                    : /^\s*[-*]\s+/.test(lines[index]))) {
                    const item = document.createElement('li');
                    item.innerHTML = formatCfoInlineMarkdown(lines[index++].replace(/^\s*(?:[-*]|\d+[.)])\s+/, ''));
                    list.appendChild(item);
                }
                element.appendChild(list);
                continue;
            }
            const paragraph = [line.trim()];
            index++;
            while (index < lines.length && lines[index].trim() &&
                !/^(#{1,4})\s+/.test(lines[index]) &&
                !/^\s*[-*]\s+/.test(lines[index]) &&
                !/^\s*\d+[.)]\s+/.test(lines[index]) &&
                !(index + 1 < lines.length && lines[index].includes('|') && isTableRule(lines[index + 1]))) {
                paragraph.push(lines[index++].trim());
            }
            appendParagraph(paragraph.join(' '));
        }
    };

    const getCfoConversationStorageKey = () => {
        const account = currentUser?.email || currentUser?.name || 'account';
        return `cfo-conversation-title:${String(account).toLowerCase()}`;
    };

    const updateCfoHistoryEntry = () => {
        const title = document.getElementById('cfo-history-title');
        const preview = document.getElementById('cfo-history-preview');
        const entry = document.getElementById('cfo-history-entry');
        if (!title || !preview || !entry) return;
        const firstQuestion = cfoChatHistory.find(item => item.role === 'user')?.content;
        cfoConversationTitle = localStorage.getItem(getCfoConversationStorageKey()) ||
            (firstQuestion ? firstQuestion.slice(0, 42) : 'Investment review');
        title.textContent = cfoConversationTitle;
        preview.textContent = firstQuestion || 'Your saved CFO conversation';
        const search = document.getElementById('cfo-history-search')?.value.trim().toLowerCase();
        const searchableText = `${cfoConversationTitle} ${cfoChatHistory.map(item => item.content).join(' ')}`.toLowerCase();
        const matches = !search || searchableText.includes(search);
        entry.classList.toggle('hidden', !matches);
        document.getElementById('cfo-history-empty')?.classList.toggle('hidden', matches);
    };

    const appendCfoMessageActions = (message, question, answer) => {
        if (!message || message.querySelector('.cfo-message-actions')) return;
        const actions = document.createElement('div');
        actions.className = 'cfo-message-actions';
        const copy = document.createElement('button');
        copy.type = 'button';
        copy.textContent = 'Copy';
        copy.setAttribute('aria-label', 'Copy AI response');
        copy.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(answer);
                copy.textContent = 'Copied';
                window.setTimeout(() => { copy.textContent = 'Copy'; }, 1400);
            } catch (error) {
                console.error('Unable to copy AI CFO response:', error.name || 'UnknownError');
                copy.textContent = 'Copy unavailable';
            }
        });
        const regenerate = document.createElement('button');
        regenerate.type = 'button';
        regenerate.textContent = 'Regenerate';
        regenerate.setAttribute('aria-label', 'Regenerate AI response');
        regenerate.addEventListener('click', () => {
            const input = document.getElementById('cfo-chat-input');
            const form = document.getElementById('cfo-chat-form');
            if (input && form && !input.disabled) {
                input.value = question;
                form.requestSubmit();
            }
        });
        actions.append(copy, regenerate);
        message.appendChild(actions);
    };

    const appendCfoConversionActions = (message, actionItems = []) => {
        if (!message || !Array.isArray(actionItems) || !actionItems.length) return;
        const supportedActions = {
            import_external_portfolio: {
                label: 'Import statement values',
                run: () => showMFCentralModal()
            },
            compare_funds: {
                label: 'Compare funds',
                run: () => {
                    if (!cfoChatInput || !cfoChatForm || cfoChatInput.disabled) return;
                    cfoChatInput.value = 'Compare the funds discussed above using verified data available to LiveInvestments. State missing information and do not initiate any transaction.';
                    cfoChatForm.requestSubmit();
                }
            },
            explore_funds: {
                label: 'Explore mutual funds',
                run: () => {
                    switchTab('explore');
                    exploreFundsSearch?.focus();
                }
            },
            get_investment_assistance: {
                label: 'Get investment assistance',
                run: () => {
                    const meetingModal = document.getElementById('meeting-modal');
                    if (!meetingModal) return;
                    const profile = currentUser || {};
                    const name = document.getElementById('meeting-name');
                    const email = document.getElementById('meeting-email');
                    const phone = document.getElementById('meeting-phone');
                    if (name && !name.value) name.value = profile.name || '';
                    if (email && !email.value) email.value = profile.email || '';
                    if (phone && !phone.value) phone.value = profile.phone || '';
                    meetingModal.classList.remove('hidden');
                }
            },
            review_portfolio: {
                label: 'View portfolio metrics',
                run: async () => {
                    switchTab('cfo');
                    await fetchAndRenderCFO();
                    const details = document.querySelector('#cfo-results .cfo-analysis-disclosure');
                    if (details) {
                        details.open = true;
                        details.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                }
            }
        };
        const container = document.createElement('div');
        container.className = 'cfo-conversion-actions';
        actionItems.forEach(item => {
            const supported = supportedActions[item?.id];
            if (!supported) return;
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'cfo-conversion-action';
            button.textContent = supported.label;
            button.addEventListener('click', supported.run);
            container.appendChild(button);
        });
        if (container.childElementCount) message.appendChild(container);
    };

    const appendCfoChatMessage = (text, sender) => {
        const messages = document.getElementById('cfo-chat-messages');
        if (!messages) return null;

        const row = document.createElement('div');
        row.className = `cfo-chat-row ${sender}`;

        const avatar = document.createElement('span');
        avatar.className = 'cfo-chat-row-avatar';
        avatar.setAttribute('aria-hidden', 'true');
        avatar.textContent = sender === 'assistant' ? '✦' : 'YOU';

        const message = document.createElement('div');
        message.className = `cfo-chat-message ${sender}`;
        const content = document.createElement('div');
        content.className = 'cfo-message-content';
        if (sender === 'assistant') renderCfoMarkdown(content, text);
        else content.textContent = text;
        message.appendChild(content);
        row.append(avatar, message);
        messages.appendChild(row);
        messages.scrollTop = messages.scrollHeight;
        return message;
    };

    const appendCfoWorkflowMessage = () => {
        const message = appendCfoChatMessage('', 'assistant');
        if (!message) return null;
        return { message, reply: message.querySelector('.cfo-message-content') };
    };

    const updateCfoWorkflow = (workflow, event) => {
        if (!workflow) return;
        if (event.type === 'status') {
            addCfoExecutionStatus(event.message, 'running');
            return;
        }
        if (event.type === 'tool') {
            updateCfoExecutionTool(event);
            return;
        }
        if (event.type === 'token') {
            setCfoExecutionLiveStatus('Synthesizing response', 'running');
            if (!workflow.synthesisEvent) {
                workflow.synthesisEvent = addCfoExecutionStatus('Generating response', 'running');
                if (workflow.synthesisEvent) workflow.synthesisEvent.dataset.synthesis = 'true';
            }
            if (!workflow.reply.dataset.streaming) {
                workflow.reply.replaceChildren();
                workflow.reply.dataset.streaming = 'true';
                workflow.reply.dataset.markdown = '';
            }
            workflow.reply.dataset.markdown += event.text;
            renderCfoMarkdown(workflow.reply, workflow.reply.dataset.markdown);
            const messages = document.getElementById('cfo-chat-messages');
            if (messages) messages.scrollTop = messages.scrollHeight;
            return;
        }
        if (event.type === 'done') {
            if (!workflow.synthesisEvent) {
                workflow.synthesisEvent = addCfoExecutionStatus('Response synthesis', 'complete');
            } else {
                workflow.synthesisEvent.dataset.state = 'complete';
                const state = workflow.synthesisEvent.querySelector('summary small');
                if (state) state.textContent = 'Complete';
                const description = workflow.synthesisEvent.querySelector('p');
                if (description) description.textContent = 'The assistant completed its response stream.';
            }
            setCfoExecutionLiveStatus('Response complete', 'complete');
            finishCfoExecutionTimer();
            appendCfoMessageActions(workflow.message, workflow.question, event.reply || workflow.reply.dataset.markdown || '');
            appendCfoConversionActions(workflow.message, event.actions);
        }
    };

    const setCfoExecutionLiveStatus = (label, state) => {
        const status = document.getElementById('cfo-agent-live-status');
        const text = document.getElementById('cfo-agent-live-label');
        if (status) status.dataset.state = state;
        if (text) text.textContent = label;
    };

    const updateCfoExecutionDuration = () => {
        const duration = document.getElementById('cfo-agent-duration');
        if (!duration || !cfoExecutionStartedAt) return;
        const seconds = Math.max(0, (Date.now() - cfoExecutionStartedAt) / 1000);
        duration.textContent = `${seconds.toFixed(1)}s`;
    };

    const finishCfoExecutionTimer = () => {
        if (cfoExecutionTimer) window.clearInterval(cfoExecutionTimer);
        cfoExecutionTimer = null;
        updateCfoExecutionDuration();
    };

    const addCfoExecutionStatus = (label, state) => {
        const list = document.getElementById('cfo-agent-events');
        if (!list) return;
        list.querySelector('.cfo-agent-empty')?.remove();
        const item = document.createElement('li');
        item.className = 'cfo-agent-event';
        item.dataset.state = state;
        const details = document.createElement('details');
        details.open = true;
        const summary = document.createElement('summary');
        const marker = document.createElement('span');
        marker.className = 'cfo-agent-event-marker';
        marker.setAttribute('aria-hidden', 'true');
        const title = document.createElement('span');
        title.className = 'cfo-agent-event-title';
        title.textContent = label;
        const stateLabel = document.createElement('small');
        stateLabel.textContent = state === 'error' ? 'Failed' : state === 'complete' ? 'Complete' : 'Active';
        summary.append(marker, title, stateLabel);
        const description = document.createElement('p');
        description.textContent = 'Status update received from the active assistant stream.';
        details.append(summary, description);
        item.appendChild(details);
        list.appendChild(item);
        list.scrollTop = list.scrollHeight;
        return item;
    };

    const updateCfoExecutionTool = event => {
        const list = document.getElementById('cfo-agent-events');
        if (!list) return;
        list.querySelector('.cfo-agent-empty')?.remove();
        const candidates = [...list.querySelectorAll('.cfo-agent-event[data-tool-label]')];
        let item = event.state === 'running'
            ? null
            : candidates.reverse().find(candidate =>
                candidate.dataset.toolLabel === event.label && candidate.dataset.state === 'running'
            );
        if (!item) {
            item = document.createElement('li');
            item.className = 'cfo-agent-event';
            item.dataset.toolLabel = event.label;
            item.dataset.startedAt = String(Date.now());
            const details = document.createElement('details');
            details.open = true;
            const summary = document.createElement('summary');
            const marker = document.createElement('span');
            marker.className = 'cfo-agent-event-marker';
            marker.setAttribute('aria-hidden', 'true');
            const title = document.createElement('span');
            title.className = 'cfo-agent-event-title';
            title.textContent = event.label;
            const state = document.createElement('small');
            state.className = 'cfo-agent-event-state';
            summary.append(marker, title, state);
            const description = document.createElement('p');
            description.textContent = 'Tool name and state are provided by the LangChain execution stream. Tool inputs and outputs are not exposed to the chat UI.';
            details.append(summary, description);
            item.appendChild(details);
            list.appendChild(item);
        }
        item.dataset.state = event.state === 'error' ? 'error' :
            event.state === 'complete' ? 'complete' : 'running';
        const stateLabel = item.querySelector('.cfo-agent-event-state');
        if (stateLabel) {
            stateLabel.textContent = event.state === 'error' ? 'Failed' :
                event.state === 'complete' ? 'Complete' : 'Running';
        }
        if (event.state !== 'running') {
            const elapsed = Math.max(0, (Date.now() - Number(item.dataset.startedAt)) / 1000);
            const timing = document.createElement('span');
            timing.className = 'cfo-agent-event-duration';
            timing.textContent = `${elapsed.toFixed(1)}s`;
            item.querySelector('summary')?.appendChild(timing);
        }
        setCfoExecutionLiveStatus(
            event.state === 'error' ? 'A tool reported an error' :
                event.state === 'complete' ? 'Tool completed' : event.label,
            event.state === 'error' ? 'error' : 'running'
        );
        list.scrollTop = list.scrollHeight;
    };

    const startCfoExecution = () => {
        const list = document.getElementById('cfo-agent-events');
        list?.replaceChildren();
        cfoExecutionStartedAt = Date.now();
        document.getElementById('cfo-agent-duration').textContent = '0.0s';
        setCfoExecutionLiveStatus('Request received', 'running');
        if (cfoExecutionTimer) window.clearInterval(cfoExecutionTimer);
        cfoExecutionTimer = window.setInterval(updateCfoExecutionDuration, 250);
    };

    const initializeCfoChat = () => {
        const messages = document.getElementById('cfo-chat-messages');
        if (!messages) return;

        cfoChatHistory.length = 0;
        cfoConversationTitle = '';
        messages.replaceChildren();
        document.getElementById('cfo-chat-starters')?.classList.remove('hidden');
        setCfoChatStatus('Ready');
        document.getElementById('cfo-agent-events')?.replaceChildren();
        document.getElementById('cfo-agent-events')?.insertAdjacentHTML(
            'beforeend',
            '<li class="cfo-agent-empty">Execution events appear here when the assistant receives them.</li>'
        );
        document.getElementById('cfo-agent-duration').textContent = '—';
        setCfoExecutionLiveStatus('Waiting for a question', 'waiting');
        const name = currentUser?.name || 'there';
        appendCfoChatMessage(
            `## Hi ${name}\nI’m your AI CFO. Ask me to analyse your recorded portfolio, explain a fund metric, or research public mutual-fund data.\n\nFor a fund shortlist, tell me your investment horizon and risk comfort.`,
            'assistant'
        );
        updateCfoHistoryEntry();
    };

    const loadCfoChatHistory = async () => {
        try {
            const response = await fetch('/api/cfo/history');
            if (!response.ok) throw new Error('Unable to load saved chat history.');
            const data = await response.json();
            if (!Array.isArray(data.messages) || data.messages.length === 0) {
                updateCfoHistoryEntry();
                return;
            }

            const messages = document.getElementById('cfo-chat-messages');
            messages?.replaceChildren();
            cfoChatHistory.splice(0, cfoChatHistory.length, ...data.messages);
            let previousQuestion = '';
            data.messages.forEach(item => {
                const message = appendCfoChatMessage(item.content, item.role);
                if (item.role === 'user') previousQuestion = item.content;
                else if (item.role === 'assistant' && message) appendCfoMessageActions(message, previousQuestion, item.content);
            });
            document.getElementById('cfo-chat-starters')?.classList.add('hidden');
            updateCfoHistoryEntry();
        } catch (error) {
            console.error('Unable to load saved AI CFO history:', error);
            setCfoChatStatus('History unavailable', 'error');
        }
    };

    const setCfoChatStatus = (text, state = 'ready') => {
        const status = document.getElementById('cfo-chat-status');
        const statusText = document.getElementById('cfo-chat-status-text');
        if (!status || !statusText) return;

        status.classList.toggle('is-busy', state === 'busy');
        status.classList.toggle('is-error', state === 'error');
        statusText.textContent = text;
    };

    // --- View Management ---
    const showLoginModal = () => {
        loginModal.classList.remove('hidden');
        loginError.textContent = '';
        loginForm.classList.remove('hidden');
        signupForm.classList.add('hidden');
        document.getElementById('modal-title').textContent = 'Login';
        document.getElementById('modal-subtitle').textContent = 'Please log in to view your portfolio.';
        document.getElementById('show-signup').classList.remove('hidden');
        document.getElementById('show-login').classList.add('hidden');
    };

    const hideLoginModal = () => {
        loginModal.classList.add('hidden');
    };

    const showSignupForm = () => {
        loginForm.classList.add('hidden');
        signupForm.classList.remove('hidden');
        signupError.textContent = '';
        signupSuccess.textContent = '';
        document.getElementById('modal-title').textContent = 'Create Account';
        document.getElementById('modal-subtitle').textContent = 'Sign up to start investing.';
        document.getElementById('show-signup').classList.add('hidden');
        document.getElementById('show-login').classList.remove('hidden');
    };

    const showDashboard = () => {
        landingView.classList.remove('active');
        landingView.classList.add('hidden');

        dashboardView.classList.remove('hidden');
        dashboardView.classList.add('active');

        navLoginBtn.classList.add('hidden');
        navGetStartedBtn.classList.add('hidden');
        navLogoutBtn.classList.remove('hidden');
    };

    const showLanding = () => {
        dashboardView.classList.remove('active');
        dashboardView.classList.add('hidden');

        landingView.classList.remove('hidden');
        landingView.classList.add('active');

        navLogoutBtn.classList.add('hidden');
        navLoginBtn.classList.remove('hidden');
        navGetStartedBtn.classList.remove('hidden');
    };

    // --- Dashboard Rendering ---
    const renderDashboard = (user) => {
        initializeCfoChat();
        loadCfoChatHistory();
        userNameDisplay.textContent = user.profile.name;
        const portfolio = user.portfolio;

        // Summary
        totalInvestedEl.textContent = formatCurrency(portfolio.totalInvested);
        currentValueEl.textContent = formatCurrency(portfolio.currentValue);

        const absoluteReturn = portfolio.currentValue - portfolio.totalInvested;
        const percentReturn = portfolio.totalInvested > 0 ? (absoluteReturn / portfolio.totalInvested) * 100 : 0;

        totalReturnsEl.textContent = formatCurrency(absoluteReturn);
        returnsPercentageEl.textContent = formatPercentage(percentReturn);

        // Style the returns based on positive/negative
        if (absoluteReturn >= 0) {
            returnsPercentageEl.classList.remove('negative');
        } else {
            returnsPercentageEl.classList.add('negative');
        }

        // Update MF Central Modal credentials from user profile
        const mfcPanDisplay = document.getElementById('mfc-pan-display');
        const mfcMobileDisplay = document.getElementById('mfc-mobile-display');
        if (mfcPanDisplay) mfcPanDisplay.textContent = user.profile.pan || '-';
        if (mfcMobileDisplay) mfcMobileDisplay.textContent = user.profile.phone || '-';

        // Investments Table
        investmentsTbody.innerHTML = '';

        if (portfolio.investments.length === 0) {
            investmentsTbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem;">No holdings recorded. Add actual values from a current statement to get started.</td></tr>';
            return;
        }

        portfolio.investments.forEach(inv => {
            const absoluteInvReturn = inv.currentValue - inv.investedAmount;
            const isPositive = absoluteInvReturn >= 0;
            const pillClass = isPositive ? 'positive' : 'negative';
            const arrowSign = isPositive ? '▲' : '▼';
            const isExt = inv.isExternal;

            const tr = document.createElement('tr');
            tr.innerHTML = `
        <td><div class="fund-name">${inv.name}</div></td>
        <td><div class="fund-category">${inv.category}</div></td>
        <td>
          <span style="display: inline-block; font-size: 0.75rem; font-weight: 700; padding: 0.2rem 0.55rem; border-radius: 4px; background: ${isExt ? 'rgba(6, 182, 212, 0.12)' : 'rgba(16, 185, 129, 0.12)'}; color: ${isExt ? '#0891b2' : '#059669'};">
            ${inv.source || (isExt ? 'Manual entry' : 'User record')}
          </span>
        </td>
        <td>${formatCurrency(inv.investedAmount)}</td>
        <td>${formatCurrency(inv.currentValue)}</td>
        <td>
          <div class="return-pill ${pillClass}">
            ${arrowSign} ${formatCurrency(Math.abs(absoluteInvReturn))} (${formatPercentage(inv.returnsPercent)})
          </div>
        </td>
      `;
            investmentsTbody.appendChild(tr);
        });
    };

    // --- Explore Funds Rendering ---
    const fetchExploreFunds = async query => {
        const searchTerm = String(query || '').trim().slice(0, 100);
        if (!searchTerm) return;
        const searchParams = new URLSearchParams({ q: searchTerm });
        try {
            const res = await fetch(`/api/portfolio/explore?${searchParams.toString()}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Unable to load public fund research.');
            renderExploreFundsGrid(data.data?.funds || []);
        } catch (error) {
            console.error('Error fetching explore funds:', error);
            exploreFundsGrid.textContent = error.message || 'Verified public fund research is unavailable.';
        }
    };

    const renderExploreFundsGrid = (fundsList) => {
        exploreFundsGrid.innerHTML = '';
        if (!fundsList.length) {
            exploreFundsGrid.textContent = 'No public funds matched this search.';
            return;
        }
        fundsList.forEach(fund => {
            const card = document.createElement('div');
            card.classList.add('fund-card');
            const title = document.createElement('h3');
            title.className = 'fund-title';
            title.textContent = fund.scheme_name || 'Unnamed mutual fund';
            const category = document.createElement('p');
            category.className = 'fund-description';
            category.textContent = fund.fund_type || 'Category unavailable';
            const amc = document.createElement('p');
            amc.className = 'fund-description';
            amc.textContent = fund.amc_name || 'AMC unavailable';
            const code = document.createElement('p');
            code.className = 'fund-description';
            code.textContent = `AMFI scheme code: ${fund.scheme_code || 'Unavailable'}`;
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'btn btn-primary full-width';
            button.textContent = 'Ask AI CFO to research';
            button.disabled = !fund.scheme_code;
            button.addEventListener('click', () => {
                switchTab('cfo');
                cfoChatInput.value = `Research ${fund.scheme_name} (AMFI scheme code ${fund.scheme_code})`;
                cfoChatForm?.requestSubmit();
            });
            card.append(title, category, amc, code, button);
            exploreFundsGrid.appendChild(card);
        });
    };

    // --- Tab Management ---
    const switchTab = (tabName) => {
        dashboardView.classList.toggle('cfo-active', tabName === 'cfo');
        tabPortfolio.classList.toggle('active', tabName === 'portfolio');
        if (tabCfo) tabCfo.classList.toggle('active', tabName === 'cfo');
        tabExplore.classList.toggle('active', tabName === 'explore');

        portfolioSection.classList.toggle('active', tabName === 'portfolio');
        portfolioSection.classList.toggle('hidden', tabName !== 'portfolio');

        if (cfoSection) {
            cfoSection.classList.toggle('active', tabName === 'cfo');
            cfoSection.classList.toggle('hidden', tabName !== 'cfo');
        }

        exploreSection.classList.toggle('active', tabName === 'explore');
        exploreSection.classList.toggle('hidden', tabName !== 'explore');

        if (tabName === 'cfo') {
            fetchAndRenderCFO();
        }
    };

    // --- AI CFO Review Rendering ---
    const fetchAndRenderCFO = async () => {
        const cfoLoading = document.getElementById('cfo-loading');
        const cfoEmpty = document.getElementById('cfo-empty-state');
        const cfoResults = document.getElementById('cfo-results');
        if (!cfoLoading || !cfoResults || !cfoEmpty) return;

        cfoLoading.classList.remove('hidden');
        cfoEmpty.classList.add('hidden');
        cfoResults.classList.add('hidden');
        try {
            const response = await fetch('/api/portfolio/ai-analysis');
            if (!response.ok) throw new Error('Unable to load your portfolio analysis.');
            const data = await response.json();
            cfoLoading.classList.add('hidden');
            if (!data.hasHoldings) {
                cfoEmpty.classList.remove('hidden');
                return;
            }

            const summary = data.summary;
            const valueElement = document.getElementById('cfo-total-corpus');
            const gainElement = document.getElementById('cfo-total-gain');
            if (valueElement) valueElement.textContent = formatCurrency(summary.currentValue);
            if (gainElement) {
                const gain = summary.absoluteReturn.amount;
                const percent = summary.absoluteReturn.percentage;
                gainElement.textContent = `${gain >= 0 ? '+' : ''}${formatCurrency(gain)}${percent === null ? '' : ` (${percent >= 0 ? '+' : ''}${percent}%)`} snapshot change`;
                gainElement.style.color = gain >= 0 ? 'var(--colorSuccess)' : 'var(--colorDanger)';
            }
            const xirrElement = document.getElementById('cfo-xirr');
            if (xirrElement) {
                xirrElement.textContent = summary.xirrPercent === null
                    ? 'Unavailable — dated cash flows required'
                    : `${summary.xirrPercent}% as of ${new Date(summary.asOf).toLocaleDateString()}`;
            }
            const cagrElement = document.getElementById('cfo-cagr');
            if (cagrElement) {
                cagrElement.textContent = summary.cagrPercent === null
                    ? 'Unavailable — one dated purchase per holding required'
                    : `${summary.cagrPercent}%`;
            }
            const gainsElement = document.getElementById('cfo-realized-gain');
            if (gainsElement) {
                gainsElement.textContent = summary.realizedUnrealized.available
                    ? `${formatCurrency(summary.realizedUnrealized.realizedGain)} / ${formatCurrency(summary.realizedUnrealized.unrealizedGain)}`
                    : `Unavailable — ${summary.realizedUnrealized.reason}`;
            }
            const investedElement = document.getElementById('cfo-total-invested');
            if (investedElement) investedElement.textContent = formatCurrency(summary.totalInvested);

            const allocationContainer = document.getElementById('cfo-allocation-list');
            if (allocationContainer) {
                allocationContainer.replaceChildren();
                summary.allocation.forEach(item => {
                    const row = document.createElement('div');
                    row.className = 'cfo-analysis-row';
                    const label = document.createElement('span');
                    label.textContent = item.category;
                    const value = document.createElement('strong');
                    value.textContent = `${formatCurrency(item.currentValue)} · ${item.percentage}%`;
                    row.append(label, value);
                    allocationContainer.appendChild(row);
                });
            }

            const holdingsContainer = document.getElementById('cfo-holdings-list');
            if (holdingsContainer) {
                holdingsContainer.replaceChildren();
                data.holdings.forEach(item => {
                    const row = document.createElement('div');
                    row.className = 'cfo-analysis-row';
                    const label = document.createElement('span');
                    label.textContent = `${item.fundName} · ${item.category}`;
                    const value = document.createElement('strong');
                    value.textContent = formatCurrency(item.currentValue);
                    row.append(label, value);
                    holdingsContainer.appendChild(row);
                });
            }

            const limitationsContainer = document.getElementById('cfo-data-limitations');
            if (limitationsContainer) {
                limitationsContainer.replaceChildren();
                summary.dataLimitations.forEach(text => {
                    const item = document.createElement('li');
                    item.textContent = text;
                    limitationsContainer.appendChild(item);
                });
            }
            cfoResults.classList.remove('hidden');
        } catch (error) {
            console.error('Error loading AI CFO data:', error);
            cfoLoading.classList.add('hidden');
            cfoEmpty.classList.remove('hidden');
            cfoEmpty.querySelector('p').textContent = error.message || 'Unable to load your portfolio analysis.';
        }
    };

    // --- Authentication Actions ---
    const handleLogin = async (e) => {
        e.preventDefault();
        const username = usernameInput.value.trim();
        const password = passwordInput.value;

        const submitBtn = loginForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Authenticating...';
        submitBtn.disabled = true;

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (response.ok) {
                currentUser = data.user;
                hideLoginModal();
                fetchAndRenderDashboard();
            } else {
                loginError.textContent = data.error || 'Invalid credentials.';
            }
        } catch (error) {
            console.error('Login error:', error);
            loginError.textContent = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
                ? 'Could not reach the local server. Run "npm run dev" from the project folder, then try again.'
                : 'Unable to connect to the server. Please check your connection and try again.';
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    };

    const fetchAndRenderDashboard = async () => {
        try {
            const res = await fetch('/api/portfolio');
            if (!res.ok) {
                if (res.status === 401) handleLogout();
                throw new Error('Failed to fetch portfolio data');
            }
            const data = await res.json();
            currentUser = data.profile;
            currentPortfolio = data.portfolio;
            renderDashboard(data);
            showDashboard();
        } catch (error) {
            console.error('Dashboard error:', error);
            totalInvestedEl.textContent = 'Error';
            currentValueEl.textContent = 'Error';
        }
    };

    const handleSignup = async (e) => {
        e.preventDefault();
        const name = document.getElementById('signup-name').value.trim();
        const email = document.getElementById('signup-email').value.trim();
        const phone = document.getElementById('signup-phone').value.trim();
        const pan = document.getElementById('signup-pan').value.trim().toUpperCase();
        const dob = document.getElementById('signup-dob').value; // format: YYYY-MM-DD

        signupError.textContent = '';
        signupSuccess.textContent = '';

        if (!name || !email || !phone || !pan || !dob) {
            signupError.textContent = 'Please fill in all fields.';
            return;
        }

        // Date validation check is moved to backend
        const dobParts = dob.split('-'); // [YYYY, MM, DD]
        if (dobParts.length !== 3) {
            signupError.textContent = 'Invalid Date of Birth format.';
            return;
        }

        const submitBtn = signupForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Creating Account...';
        submitBtn.disabled = true;

        try {
            const response = await fetch('/api/auth/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, phone, pan, dob })
            });

            const data = await response.json();

            if (response.ok) {
                const generatedPwd = data.password || 'your DOB in DDMMYYYY (e.g. 23062003)';
                signupSuccess.innerHTML = `
                    <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid var(--colorAccent); border-radius: 8px; padding: 12px; margin-top: 10px; text-align: left;">
                        <strong>🎉 Account Created!</strong><br>
                        <strong>Username:</strong> ${data.username || email}<br>
                        <strong>Password:</strong> ${generatedPwd}<br>
                        <small style="color: var(--colorTextMuted);">Switching to login form in 3 seconds...</small>
                    </div>
                `;
                usernameInput.value = data.username || email;
                passwordInput.value = data.password || '';
                signupForm.reset();
                setTimeout(() => {
                    showLoginModal();
                    signupSuccess.innerHTML = '';
                }, 3500);
            } else {
                signupError.textContent = data.error || 'Failed to create account.';
            }
        } catch (error) {
            console.error('Signup error:', error);
            signupError.textContent = 'A network error occurred. Please try again.';
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    };

    const handleLogout = async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
        } catch (e) {
            console.error('Failed to call logout API', e);
        }
        currentUser = null;
        currentPortfolio = null;
        showLanding();
    };

    // --- Event Listeners ---
    navLoginBtn.addEventListener('click', showLoginModal);
    modalCloseBtn.addEventListener('click', hideLoginModal);

    const showSignupBtn = document.getElementById('show-signup');
    const showLoginBtn = document.getElementById('show-login');

    if (showSignupBtn) showSignupBtn.addEventListener('click', (e) => { e.preventDefault(); showSignupForm(); });
    if (showLoginBtn) showLoginBtn.addEventListener('click', (e) => { e.preventDefault(); showLoginModal(); });

    // Close modal when clicking outside
    loginModal.addEventListener('click', (e) => {
        if (e.target === loginModal) hideLoginModal();
    });

    loginForm.addEventListener('submit', handleLogin);
    signupForm.addEventListener('submit', handleSignup);
    navLogoutBtn.addEventListener('click', handleLogout);

    const cfoChatForm = document.getElementById('cfo-chat-form');
    const cfoChatInput = document.getElementById('cfo-chat-input');
    const cfoChatStarters = document.getElementById('cfo-chat-starters');
    if (cfoChatStarters && cfoChatForm && cfoChatInput) {
        cfoChatStarters.querySelectorAll('[data-chat-prompt]').forEach((starter) => {
            starter.addEventListener('click', () => {
                cfoChatInput.value = starter.dataset.chatPrompt;
                cfoChatForm.requestSubmit();
            });
        });
    }

    if (cfoChatForm && cfoChatInput) {
        cfoChatInput.addEventListener('keydown', event => {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                cfoChatForm.requestSubmit();
            }
        });
        cfoChatInput.addEventListener('input', () => {
            cfoChatInput.style.height = 'auto';
            cfoChatInput.style.height = `${Math.min(cfoChatInput.scrollHeight, 140)}px`;
        });
        cfoChatForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const question = cfoChatInput.value.trim();
            if (!question || !currentUser || !currentPortfolio) return;

            cfoChatInput.style.height = '';
            if (containsOtpSecret(question)) {
                cfoChatInput.value = '';
                appendCfoChatMessage(
                    'For your security, never share an OTP here. Enter it only on the official MF Central website or app.',
                    'assistant'
                );
                return;
            }
            appendCfoChatMessage(question, 'user');
            const workflow = appendCfoWorkflowMessage();
            if (workflow) workflow.question = question;
            cfoChatStarters?.classList.add('hidden');
            const sendButton = cfoChatForm.querySelector('button[type="submit"]');
            cfoChatInput.value = '';
            cfoChatInput.disabled = true;
            sendButton.disabled = true;
            setCfoChatStatus('Working', 'busy');
            startCfoExecution();

            try {
                const response = await fetch('/api/cfo/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: question })
                });
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'The AI CFO could not answer right now.');
                }
                if (!response.body) throw new Error('Streaming responses are not supported by this browser.');

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';
                let reply = '';
                let completed = false;
                let streamError = null;
                const handleSseBlock = block => {
                    const dataLine = block.split(/\r?\n/).find(line => line.startsWith('data:'));
                    if (!dataLine) return;
                    const event = JSON.parse(dataLine.slice(5).trim());
                    if (event.type === 'token') {
                        reply += event.text;
                        if (workflow) updateCfoWorkflow(workflow, event);
                        else appendCfoChatMessage(event.text, 'assistant');
                    } else if (event.type === 'done') {
                        completed = true;
                        if (event.reply && event.reply !== reply) {
                            reply = event.reply;
                            if (workflow) {
                                workflow.reply.dataset.markdown = reply;
                                renderCfoMarkdown(workflow.reply, reply);
                            }
                        }
                        if (workflow) {
                            updateCfoWorkflow(workflow, event);
                        }
                    } else if (event.type === 'error') {
                        streamError = event.message || 'The AI CFO could not complete this request.';
                    } else if (workflow) {
                        updateCfoWorkflow(workflow, event);
                    }
                };

                while (true) {
                    const { value, done } = await reader.read();
                    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
                    const blocks = buffer.split(/\r?\n\r?\n/);
                    buffer = blocks.pop() || '';
                    blocks.forEach(handleSseBlock);
                    if (done) break;
                }
                if (buffer.trim()) handleSseBlock(buffer);
                if (streamError) throw new Error(streamError);
                if (!completed) throw new Error('The AI CFO stream ended before the answer was complete.');

                cfoChatHistory.push(
                    { role: 'user', content: question },
                    { role: 'assistant', content: reply }
                );
                updateCfoHistoryEntry();
                setCfoChatStatus('Ready');
            } catch (error) {
                console.error('AI CFO chat request failed:', error);
                finishCfoExecutionTimer();
                setCfoExecutionLiveStatus('Request failed', 'error');
                const synthesisEvent = document.querySelector('.cfo-agent-event[data-synthesis="true"]');
                if (synthesisEvent) {
                    synthesisEvent.dataset.state = 'error';
                    const state = synthesisEvent.querySelector('summary small');
                    if (state) state.textContent = 'Failed';
                }
                addCfoExecutionStatus(error.message || 'The request could not be completed.', 'error');
                if (workflow) {
                    workflow.message.classList.add('error');
                    const failure = document.createElement('p');
                    failure.className = 'cfo-workflow-error';
                    failure.textContent = error instanceof TypeError
                        ? 'Could not reach the AI CFO. Check your connection and try again.'
                        : error.message || 'The AI CFO could not answer right now. Please try again.';
                    workflow.message.appendChild(failure);
                } else {
                    appendCfoChatMessage(
                        error instanceof TypeError
                            ? 'Could not reach the AI CFO. Check your connection and try again.'
                            : error.message || 'The AI CFO could not answer right now. Please try again.',
                        'assistant'
                    )?.classList.add('error');
                }
                setCfoChatStatus('Unable to answer', 'error');
            } finally {
                cfoChatInput.disabled = false;
                sendButton.disabled = false;
                cfoChatInput.focus();
            }
        });
    }

    const clearCfoHistoryButton = document.getElementById('cfo-chat-clear');
    if (clearCfoHistoryButton) {
        clearCfoHistoryButton.addEventListener('click', async () => {
            try {
                if (cfoChatHistory.length && !window.confirm('Start a new chat? Your saved conversation will be cleared.')) return;
                const response = await fetch('/api/cfo/history', { method: 'DELETE' });
                if (!response.ok) throw new Error('Unable to clear saved chat history.');
                localStorage.removeItem(getCfoConversationStorageKey());
                initializeCfoChat();
                setCfoChatStatus('Ready');
            } catch (error) {
                console.error('Unable to clear saved AI CFO history:', error);
                setCfoChatStatus('Could not clear history', 'error');
            }
        });
    }

    document.getElementById('cfo-history-search')?.addEventListener('input', updateCfoHistoryEntry);
    document.getElementById('cfo-history-rename')?.addEventListener('click', () => {
        const title = document.getElementById('cfo-history-title')?.textContent || 'Investment review';
        const nextTitle = window.prompt('Name this conversation', title);
        if (nextTitle === null) return;
        const trimmedTitle = nextTitle.trim().slice(0, 60);
        if (!trimmedTitle) return;
        localStorage.setItem(getCfoConversationStorageKey(), trimmedTitle);
        cfoConversationTitle = trimmedTitle;
        updateCfoHistoryEntry();
    });
    document.getElementById('cfo-history-open')?.addEventListener('click', () => {
        const messages = document.getElementById('cfo-chat-messages');
        messages?.scrollTo({ top: messages.scrollHeight, behavior: 'smooth' });
        document.getElementById('cfo-agent-shell')?.classList.remove('mobile-history-open');
    });
    const syncCfoPanelControls = () => {
        const shell = document.getElementById('cfo-agent-shell');
        if (!shell) return;
        const mobile = window.matchMedia('(max-width: 760px)').matches;
        if (!mobile) shell.classList.remove('mobile-history-open', 'mobile-agent-open');
        document.querySelectorAll('[data-cfo-panel]').forEach(button => {
            const collapsedClass = button.dataset.cfoPanel === 'agent' ? 'agent-collapsed' : 'history-collapsed';
            const expanded = mobile
                ? shell.classList.contains(`mobile-${button.dataset.cfoPanel}-open`)
                : !shell.classList.contains(collapsedClass);
            button.setAttribute('aria-expanded', String(expanded));
        });
    };
    syncCfoPanelControls();
    window.addEventListener('resize', syncCfoPanelControls);
    document.querySelectorAll('[data-cfo-panel]').forEach(button => {
        button.addEventListener('click', () => {
            const shell = document.querySelector('.cfo-agent-shell');
            const panel = button.dataset.cfoPanel;
            if (!shell) return;
            if (window.matchMedia('(max-width: 760px)').matches) {
                const panelClass = `mobile-${panel}-open`;
                const wasOpen = shell.classList.contains(panelClass);
                shell.classList.remove('mobile-history-open', 'mobile-agent-open');
                if (!wasOpen) shell.classList.add(panelClass);
                button.setAttribute('aria-expanded', String(shell.classList.contains(`mobile-${panel}-open`)));
            } else if (panel === 'agent') {
                shell.classList.toggle('agent-collapsed');
                button.setAttribute('aria-expanded', String(!shell.classList.contains('agent-collapsed')));
            } else {
                shell.classList.toggle('history-collapsed');
                button.setAttribute('aria-expanded', String(!shell.classList.contains('history-collapsed')));
            }
        });
    });
    document.querySelectorAll('[data-cfo-panel-close]').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelector('.cfo-agent-shell')?.classList.remove('mobile-history-open', 'mobile-agent-open');
            document.querySelectorAll('[data-cfo-panel]').forEach(toggle => toggle.setAttribute('aria-expanded', 'false'));
        });
    });

    tabPortfolio.addEventListener('click', () => switchTab('portfolio'));
    tabExplore.addEventListener('click', () => switchTab('explore'));
    exploreFundsSearchForm?.addEventListener('submit', async event => {
        event.preventDefault();
        const searchButton = exploreFundsSearchForm.querySelector('button[type="submit"]');
        if (searchButton) searchButton.disabled = true;
        exploreFundsGrid.textContent = 'Searching verified public fund data…';
        try {
            await fetchExploreFunds(exploreFundsSearch?.value);
        } finally {
            if (searchButton) searchButton.disabled = false;
        }
    });

    // --- Contact Form ---
    const contactForm = document.getElementById('contact-form');
    const contactError = document.getElementById('contact-error');
    const contactSuccess = document.getElementById('contact-success');

    const handleContactSubmit = async (e) => {
        e.preventDefault();
        const name = document.getElementById('contact-name').value.trim();
        const email = document.getElementById('contact-email').value.trim();
        const phone = document.getElementById('contact-phone').value.trim();
        const message = document.getElementById('contact-message').value.trim();

        contactError.textContent = '';
        contactSuccess.textContent = '';

        const submitBtn = document.getElementById('contact-submit-btn');
        submitBtn.textContent = 'Sending...';
        submitBtn.disabled = true;

        try {
            const response = await fetch('/api/contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, phone, message })
            });
            const data = await response.json();
            if (response.ok) {
                contactSuccess.textContent = data.message;
                contactForm.reset();
            } else {
                contactError.textContent = data.error || 'Submission failed. Please try again.';
            }
        } catch (err) {
            contactError.textContent = 'Network error. Please try again.';
        } finally {
            submitBtn.textContent = 'Send Message';
            submitBtn.disabled = false;
        }
    };

    if (contactForm) contactForm.addEventListener('submit', handleContactSubmit);

    // --- Privacy Policy Modal ---
    const privacyModal = document.getElementById('privacy-modal');
    const privacyLink = document.getElementById('privacy-policy-link');
    const privacyClose = document.getElementById('privacy-modal-close');

    if (privacyLink) {
        privacyLink.addEventListener('click', (e) => {
            e.preventDefault();
            privacyModal.classList.remove('hidden');
        });
    }
    if (privacyClose) {
        privacyClose.addEventListener('click', () => privacyModal.classList.add('hidden'));
    }
    if (privacyModal) {
        privacyModal.addEventListener('click', (e) => {
            if (e.target === privacyModal) privacyModal.classList.add('hidden');
        });
    }

    // --- Meeting Booking Modal ---
    const meetingModal = document.getElementById('meeting-modal');
    const meetingForm = document.getElementById('meeting-form');
    const meetingError = document.getElementById('meeting-error');
    const meetingSuccess = document.getElementById('meeting-success');

    document.getElementById('meeting-modal-close')?.addEventListener('click', () => {
        meetingModal.classList.add('hidden');
    });
    meetingModal?.addEventListener('click', (e) => {
        if (e.target === meetingModal) meetingModal.classList.add('hidden');
    });

    meetingForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('meeting-name').value.trim();
        const email = document.getElementById('meeting-email').value.trim();
        const phone = document.getElementById('meeting-phone').value.trim();
        const preferredTime = document.getElementById('meeting-time').value.trim();

        meetingError.textContent = '';
        meetingSuccess.textContent = '';

        const submitBtn = document.getElementById('meeting-submit-btn');
        submitBtn.textContent = 'Booking...';
        submitBtn.disabled = true;

        try {
            const response = await fetch('/api/meeting', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, phone, preferredTime })
            });
            const data = await response.json();
            if (response.ok) {
                meetingSuccess.textContent = data.message;
                meetingForm.reset();
                setTimeout(() => meetingModal.classList.add('hidden'), 4000);
            } else {
                meetingError.textContent = data.error || 'Booking failed. Please try again.';
            }
        } catch (err) {
            meetingError.textContent = 'Network error. Please try again.';
        } finally {
            submitBtn.textContent = 'Schedule My Meeting';
            submitBtn.disabled = false;
        }
    });

    // --- On Load Check Session ---
    const checkSession = async () => {
        try {
            const res = await fetch('/api/auth/me');
            if (res.ok) {
                // If token is valid, automatically log them in
                fetchAndRenderDashboard();
            } else {
                showLanding();
            }
        } catch (error) {
            showLanding();
        }
    };

    // Initialize view
    checkSession();

    // Check query params
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('login') === 'true') {
        showLoginModal();
        const prefillUser = urlParams.get('user') || urlParams.get('email');
        if (prefillUser) {
            usernameInput.value = prefillUser;
            passwordInput.focus();
        }
    }

    // Add Investment Button
    const addInvestmentBtn = document.getElementById('add-investment-btn');
    if (addInvestmentBtn) {
        addInvestmentBtn.addEventListener('click', () => {
            switchTab('explore');
        });
    }

    // --- MF Central Modal & Actions ---
    const mfcentralModal = document.getElementById('mfcentral-modal');
    const mfcentralCloseBtn = document.getElementById('mfcentral-modal-close');
    const btnOpenMfc1 = document.getElementById('btn-open-mfcentral-modal');
    const btnOpenMfcFeature = document.getElementById('btn-import-investments-feature');
    const btnOpenMfc3 = document.getElementById('cfo-empty-mfc-btn');
    const btnRefreshCfo = document.getElementById('btn-refresh-cfo');
    const cfoExploreBtn = document.getElementById('cfo-explore-btn');

    const showMFCentralModal = () => {
        if (!mfcentralModal) return;
        const asOfDateInput = document.getElementById('mfc-fund-as-of-date');
        if (asOfDateInput && !asOfDateInput.value) {
            asOfDateInput.value = new Date().toISOString().slice(0, 10);
        }
        mfcentralModal.classList.remove('hidden');
        const statusMsg = document.getElementById('mfc-status-msg');
        if (statusMsg) statusMsg.textContent = '';
    };

    const hideMFCentralModal = () => {
        if (mfcentralModal) mfcentralModal.classList.add('hidden');
    };

    if (btnOpenMfc1) btnOpenMfc1.addEventListener('click', showMFCentralModal);
    if (btnOpenMfcFeature) btnOpenMfcFeature.addEventListener('click', showMFCentralModal);
    if (btnOpenMfc3) btnOpenMfc3.addEventListener('click', showMFCentralModal);
    if (mfcentralCloseBtn) mfcentralCloseBtn.addEventListener('click', hideMFCentralModal);

    if (mfcentralModal) {
        mfcentralModal.addEventListener('click', (e) => {
            if (e.target === mfcentralModal) hideMFCentralModal();
        });
    }
    if (tabCfo) tabCfo.addEventListener('click', () => switchTab('cfo'));
    if (tabCfo) tabCfo.addEventListener('click', () => switchTab('cfo'));
    if (btnRefreshCfo) btnRefreshCfo.addEventListener('click', fetchAndRenderCFO);
    if (cfoExploreBtn) cfoExploreBtn.addEventListener('click', () => switchTab('explore'));

    // Toggle Manual Form in MF Central Modal
    const btnToggleManualMfc = document.getElementById('btn-toggle-manual-mfc');
    const mfcManualForm = document.getElementById('mfc-manual-form');
    if (btnToggleManualMfc && mfcManualForm) {
        btnToggleManualMfc.addEventListener('click', () => {
            mfcManualForm.classList.toggle('hidden');
        });
    }

    // Manual External Scheme Form Submission
    if (mfcManualForm) {
        mfcManualForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const statusMsg = document.getElementById('mfc-status-msg');
            const submitBtn = mfcManualForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;

            const name = document.getElementById('mfc-fund-name').value.trim();
            const category = document.getElementById('mfc-fund-category').value;
            const schemeCode = document.getElementById('mfc-fund-scheme-code').value.trim();
            const amount = Number(document.getElementById('mfc-fund-amount').value);
            const currentValue = Number(document.getElementById('mfc-fund-current-value').value);
            const asOfDate = document.getElementById('mfc-fund-as-of-date').value;

            submitBtn.disabled = true;
            submitBtn.textContent = 'Saving...';

            try {
                const res = await fetch('/api/portfolio/import-external', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        asOfDate,
                        funds: [{
                            name,
                            category,
                            ...(schemeCode ? { schemeCode } : {}),
                            investedAmount: amount,
                            currentValue
                        }]
                    })
                });

                if (!res.ok) {
                    const errData = await res.json();
                    throw new Error(errData.error || 'Failed to add external fund.');
                }

                if (statusMsg) {
                    statusMsg.style.color = 'var(--colorSuccess)';
                    statusMsg.textContent = `Saved the actual statement snapshot for ${name}. Historical transactions were not imported.`;
                }

                mfcManualForm.reset();
                mfcManualForm.classList.add('hidden');

                await fetchAndRenderDashboard();
                switchTab('cfo');

            } catch (err) {
                console.error('Save external fund error:', err);
                if (statusMsg) {
                    statusMsg.style.color = 'var(--colorDanger)';
                    statusMsg.textContent = '❌ ' + err.message;
                }
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        });
    }

});
