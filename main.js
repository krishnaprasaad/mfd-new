// Removed mock database import

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const landingView = document.getElementById('landing-view');
    const dashboardView = document.getElementById('dashboard-view');
    const orderView = document.getElementById('order-view');
    const paymentView = document.getElementById('payment-view');
    const loginModal = document.getElementById('login-modal');

    const navLoginBtn = document.getElementById('nav-login-btn');
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

    // --- State ---
    let currentUser = null;

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
        navLogoutBtn.classList.remove('hidden');
    };

    const showLanding = () => {
        dashboardView.classList.remove('active');
        dashboardView.classList.add('hidden');

        landingView.classList.remove('hidden');
        landingView.classList.add('active');

        navLogoutBtn.classList.add('hidden');
        navLoginBtn.classList.remove('hidden');
    };

    // --- Dashboard Rendering ---
    const renderDashboard = (user) => {
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
            investmentsTbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem;">No investments found. Make a new investment or sync external folios via MF Central!</td></tr>';
            return;
        }

        portfolio.investments.forEach(inv => {
            const absoluteInvReturn = inv.currentValue - inv.investedAmount;
            const isPositive = absoluteInvReturn >= 0;
            const pillClass = isPositive ? 'positive' : 'negative';
            const arrowSign = isPositive ? '▲' : '▼';
            const isExt = inv.isExternal || inv.source === 'MF Central';

            const tr = document.createElement('tr');
            tr.innerHTML = `
        <td><div class="fund-name">${inv.name}</div></td>
        <td><div class="fund-category">${inv.category}</div></td>
        <td>
          <span style="display: inline-block; font-size: 0.75rem; font-weight: 700; padding: 0.2rem 0.55rem; border-radius: 4px; background: ${isExt ? 'rgba(6, 182, 212, 0.12)' : 'rgba(16, 185, 129, 0.12)'}; color: ${isExt ? '#0891b2' : '#059669'};">
            ${isExt ? 'MF Central' : 'Direct'}
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
    const fetchExploreFunds = async () => {
        try {
            const res = await fetch('/api/portfolio/explore');
            const data = await res.json();
            renderExploreFundsGrid(data);
        } catch (error) {
            console.error('Error fetching explore funds:', error);
            exploreFundsGrid.innerHTML = '<div class="error-msg">Failed to load funds.</div>';
        }
    };

    const renderExploreFundsGrid = (fundsList) => {
        exploreFundsGrid.innerHTML = '';

        fundsList.forEach(fund => {
            const riskClass = fund.risk.toLowerCase();

            const card = document.createElement('div');
            card.classList.add('fund-card');
            card.innerHTML = `
                <div class="fund-header">
                    <div class="fund-title">${fund.name}</div>
                    <div class="fund-badges">
                        <span class="badge badge-category">${fund.category}</span>
                        <span class="badge risk-${riskClass}">${fund.risk} Risk</span>
                    </div>
                </div>
                <div class="fund-description">${fund.description}</div>
                <div class="fund-stats">
                    <div class="stat-box">
                        <div class="stat-label">Min SIP</div>
                        <div class="stat-value">₹${fund.minSip}</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-label">1Y Return</div>
                        <div class="stat-value highlight">${fund.return1Yr}%</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-label">3Y Return</div>
                        <div class="stat-value highlight">${fund.return3Yr}%</div>
                    </div>
                </div>
                <button class="btn btn-primary full-width" onclick="proceedToInvest('${fund.id}', '${fund.name}', '${fund.category}', '${fund.risk}', ${fund.minSip})">Invest Now</button>
            `;
            exploreFundsGrid.appendChild(card);
        });
    };

    // --- Tab Management ---
    const switchTab = (tabName) => {
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

        if (tabName === 'explore' && exploreFundsGrid.children.length === 0) {
            fetchExploreFunds();
        } else if (tabName === 'cfo') {
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
            const res = await fetch('/api/portfolio/ai-analysis');
            if (!res.ok) throw new Error('Failed to generate AI analysis');
            const data = await res.json();

            cfoLoading.classList.add('hidden');

            if (!data.hasHoldings) {
                cfoEmpty.classList.remove('hidden');
                return;
            }

            cfoResults.classList.remove('hidden');

            // Set Top Metrics
            document.getElementById('cfo-health-score').textContent = data.healthScore;
            document.getElementById('cfo-health-rating').textContent = data.healthRating;
            document.getElementById('cfo-total-corpus').textContent = formatCurrency(data.summary.currentValue);
            
            const gain = data.summary.overallGain;
            const gainPercent = data.summary.overallReturnPercent;
            const sign = gain >= 0 ? '+' : '';
            const gainEl = document.getElementById('cfo-total-gain');
            gainEl.textContent = `${sign}${formatCurrency(gain)} (${sign}${gainPercent}%)`;
            gainEl.style.color = gain >= 0 ? 'var(--colorSuccess)' : 'var(--colorDanger)';

            document.getElementById('cfo-internal-count').textContent = data.summary.schemesCount - data.summary.externalSchemesCount;
            document.getElementById('cfo-external-count').textContent = data.summary.externalSchemesCount;

            // Render Recommendations
            const recContainer = document.getElementById('cfo-recommendations-list');
            recContainer.innerHTML = data.recommendations.map(rec => `
                <div style="background: var(--colorSurface); border: 1px solid var(--colorBorder); border-radius: 10px; padding: 1.25rem; display: flex; flex-direction: column; justify-content: space-between; box-shadow: var(--shadowSm);">
                    <div>
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem;">
                            <span style="font-size: 1.5rem;">${rec.icon}</span>
                            <span style="font-size: 0.72rem; font-weight: 700; background: rgba(16, 185, 129, 0.1); color: var(--colorAccent); padding: 0.2rem 0.5rem; border-radius: 4px;">${rec.type}</span>
                        </div>
                        <h4 style="margin: 0 0 0.5rem 0; font-size: 0.98rem; color: var(--colorPrimary);">${rec.title}</h4>
                        <p style="margin: 0; font-size: 0.85rem; color: var(--colorTextMuted); line-height: 1.5;">${rec.description}</p>
                    </div>
                </div>
            `).join('');

            // Render Scheme Reviews (Pros and Cons)
            const reviewsContainer = document.getElementById('cfo-funds-review-list');
            reviewsContainer.innerHTML = data.fundReviews.map(f => `
                <div style="background: var(--colorSurface); border: 1px solid var(--colorBorder); border-radius: 12px; padding: 1.25rem; box-shadow: var(--shadowSm);">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 0.75rem; border-bottom: 1px solid var(--colorBorder); padding-bottom: 0.85rem; margin-bottom: 1rem;">
                        <div>
                            <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                                <h4 style="margin: 0; font-size: 1.05rem; color: var(--colorPrimary);">${f.fundName}</h4>
                                <span style="font-size: 0.72rem; padding: 0.2rem 0.5rem; border-radius: 4px; font-weight: 700; background: ${f.isExternal ? 'rgba(6, 182, 212, 0.12)' : 'rgba(16, 185, 129, 0.12)'}; color: ${f.isExternal ? '#0891b2' : '#059669'};">
                                    ${f.source || 'Direct'}
                                </span>
                            </div>
                            <div style="font-size: 0.82rem; color: var(--colorTextMuted); margin-top: 0.25rem;">
                                ${f.category} • Portfolio Weight: <strong>${f.portfolioWeight}%</strong>
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 1.1rem; font-weight: 700; color: var(--colorPrimary);">${formatCurrency(f.currentValue)}</div>
                            <div style="font-size: 0.8rem; color: ${f.returnsPercent >= 0 ? 'var(--colorSuccess)' : 'var(--colorDanger)'}; font-weight: 600;">
                                ${f.returnsPercent >= 0 ? '+' : ''}${f.returnsPercent}% returns
                            </div>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1rem;">
                        <!-- Pros -->
                        <div style="background: rgba(16, 185, 129, 0.05); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 8px; padding: 0.9rem;">
                            <div style="font-weight: 700; font-size: 0.82rem; color: #059669; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.35rem;">
                                <span>✅ Key Strengths (Pros)</span>
                            </div>
                            <ul style="margin: 0; padding-left: 1.2rem; font-size: 0.82rem; color: var(--colorText); line-height: 1.5;">
                                ${f.pros.map(p => `<li>${p}</li>`).join('')}
                            </ul>
                        </div>

                        <!-- Cons -->
                        <div style="background: rgba(239, 68, 68, 0.04); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 8px; padding: 0.9rem;">
                            <div style="font-weight: 700; font-size: 0.82rem; color: #dc2626; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.35rem;">
                                <span>⚠️ Risk Factors & Caveats (Cons)</span>
                            </div>
                            <ul style="margin: 0; padding-left: 1.2rem; font-size: 0.82rem; color: var(--colorText); line-height: 1.5;">
                                ${f.cons.map(c => `<li>${c}</li>`).join('')}
                            </ul>
                        </div>
                    </div>
                </div>
            `).join('');

        } catch (err) {
            console.error('Error loading AI CFO data:', err);
            cfoLoading.classList.add('hidden');
            cfoEmpty.classList.remove('hidden');
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
            loginError.textContent = 'A network error occurred. Please try again.';
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

    tabPortfolio.addEventListener('click', () => switchTab('portfolio'));
    tabExplore.addEventListener('click', () => switchTab('explore'));

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
    const btnOpenMfc2 = document.getElementById('btn-sync-mfc-header');
    const btnOpenMfc3 = document.getElementById('cfo-empty-mfc-btn');
    const btnRunCfo = document.getElementById('btn-run-cfo-analysis');
    const btnRefreshCfo = document.getElementById('btn-refresh-cfo');
    const cfoExploreBtn = document.getElementById('cfo-explore-btn');

    const showMFCentralModal = () => {
        if (!mfcentralModal) return;
        if (currentUser) {
            const panEl = document.getElementById('mfc-pan-display');
            const mobileEl = document.getElementById('mfc-mobile-display');
            if (panEl) panEl.textContent = currentUser.pan || 'ABCDE1234F';
            if (mobileEl) mobileEl.textContent = currentUser.phone || '+91 98765 43210';
        }
        mfcentralModal.classList.remove('hidden');
        const statusMsg = document.getElementById('mfc-status-msg');
        if (statusMsg) statusMsg.textContent = '';
    };

    const hideMFCentralModal = () => {
        if (mfcentralModal) mfcentralModal.classList.add('hidden');
    };

    if (btnOpenMfc1) btnOpenMfc1.addEventListener('click', showMFCentralModal);
    if (btnOpenMfc2) btnOpenMfc2.addEventListener('click', showMFCentralModal);
    if (btnOpenMfc3) btnOpenMfc3.addEventListener('click', showMFCentralModal);
    if (mfcentralCloseBtn) mfcentralCloseBtn.addEventListener('click', hideMFCentralModal);

    if (mfcentralModal) {
        mfcentralModal.addEventListener('click', (e) => {
            if (e.target === mfcentralModal) hideMFCentralModal();
        });
    }

    if (tabCfo) tabCfo.addEventListener('click', () => switchTab('cfo'));
    if (btnRunCfo) btnRunCfo.addEventListener('click', () => switchTab('cfo'));
    if (btnRefreshCfo) btnRefreshCfo.addEventListener('click', fetchAndRenderCFO);
    if (cfoExploreBtn) cfoExploreBtn.addEventListener('click', () => switchTab('explore'));

    // Copy to clipboard helper for PAN & mobile
    document.querySelectorAll('.btn-copy-mfc').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            const targetEl = document.getElementById(targetId);
            if (targetEl && targetEl.textContent) {
                navigator.clipboard.writeText(targetEl.textContent.trim());
                const originalText = btn.textContent;
                btn.textContent = 'Copied!';
                btn.style.color = 'var(--colorAccent)';
                setTimeout(() => {
                    btn.textContent = originalText;
                    btn.style.color = '';
                }, 1500);
            }
        });
    });

    // Toggle Manual Form in MF Central Modal
    const btnToggleManualMfc = document.getElementById('btn-toggle-manual-mfc');
    const mfcManualForm = document.getElementById('mfc-manual-form');
    if (btnToggleManualMfc && mfcManualForm) {
        btnToggleManualMfc.addEventListener('click', () => {
            mfcManualForm.classList.toggle('hidden');
        });
    }

    // Quick Sync Sample External Folios
    const btnQuickImportMfc = document.getElementById('btn-quick-import-mfc');
    if (btnQuickImportMfc) {
        btnQuickImportMfc.addEventListener('click', async () => {
            const statusMsg = document.getElementById('mfc-status-msg');
            const originalContent = btnQuickImportMfc.innerHTML;

            btnQuickImportMfc.disabled = true;
            btnQuickImportMfc.innerHTML = '<span>⏳ Syncing folios from CAS...</span>';
            if (statusMsg) {
                statusMsg.style.color = 'var(--colorPrimary)';
                statusMsg.textContent = 'Syncing CAMS & KFintech CAS folios with database...';
            }

            try {
                const sampleExternalFolios = [
                    {
                        fundId: 'mfc-ext-001',
                        name: 'Axis Bluechip Fund',
                        category: 'Large Cap',
                        investedAmount: 35000,
                        currentValue: 42800
                    },
                    {
                        fundId: 'mfc-ext-002',
                        name: 'ICICI Prudential Balanced Advantage Fund',
                        category: 'Balanced Advantage',
                        investedAmount: 50000,
                        currentValue: 58500
                    },
                    {
                        fundId: 'mfc-ext-003',
                        name: 'SBI Small Cap Fund',
                        category: 'Small Cap',
                        investedAmount: 20000,
                        currentValue: 27900
                    }
                ];

                const res = await fetch('/api/portfolio/import-external', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ funds: sampleExternalFolios })
                });

                if (!res.ok) {
                    const errData = await res.json();
                    throw new Error(errData.error || 'Failed to sync external mutual funds.');
                }

                if (statusMsg) {
                    statusMsg.style.color = 'var(--colorSuccess)';
                    statusMsg.textContent = '✅ Synced 3 external folios! Opening AI CFO analysis...';
                }

                setTimeout(async () => {
                    hideMFCentralModal();
                    await fetchAndRenderDashboard();
                    switchTab('cfo');
                }, 1200);

            } catch (err) {
                console.error('MF Central sync error:', err);
                if (statusMsg) {
                    statusMsg.style.color = 'var(--colorDanger)';
                    statusMsg.textContent = '❌ ' + err.message;
                }
            } finally {
                btnQuickImportMfc.disabled = false;
                btnQuickImportMfc.innerHTML = originalContent;
            }
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
            const amount = Number(document.getElementById('mfc-fund-amount').value);

            submitBtn.disabled = true;
            submitBtn.textContent = 'Saving...';

            try {
                const res = await fetch('/api/portfolio/import-external', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        funds: [{
                            name,
                            category,
                            investedAmount: amount,
                            currentValue: Math.round(amount * 1.15)
                        }]
                    })
                });

                if (!res.ok) {
                    const errData = await res.json();
                    throw new Error(errData.error || 'Failed to add external fund.');
                }

                if (statusMsg) {
                    statusMsg.style.color = 'var(--colorSuccess)';
                    statusMsg.textContent = `✅ Saved ${name}! Opening AI CFO Review...`;
                }

                mfcManualForm.reset();
                mfcManualForm.classList.add('hidden');

                setTimeout(async () => {
                    hideMFCentralModal();
                    await fetchAndRenderDashboard();
                    switchTab('cfo');
                }, 1200);

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

    // --- Checkout Flow Logic ---
    let currentCheckoutFund = null;

    window.proceedToInvest = (id, name, category, risk, minSip) => {
        currentCheckoutFund = { id, name, category, risk, minSip };
        
        // Populate order view
        document.getElementById('order-fund-name').textContent = name;
        document.getElementById('order-fund-category').textContent = `${category} • ${risk} Risk`;
        
        const amountInput = document.getElementById('invest-amount');
        amountInput.min = minSip;
        amountInput.placeholder = `Min ₹${minSip}`;
        document.getElementById('min-amount-hint').textContent = `Minimum investment: ₹${minSip}`;
        
        // Hide dashboard, show order view
        dashboardView.classList.add('hidden');
        dashboardView.classList.remove('active');
        orderView.classList.remove('hidden');
        orderView.classList.add('active');
        window.scrollTo(0, 0);
    };

    const  orderBackBtn = document.getElementById('order-back-btn');
    if (orderBackBtn) {
        orderBackBtn.addEventListener('click', () => {
            orderView.classList.add('hidden');
            orderView.classList.remove('active');
            dashboardView.classList.remove('hidden');
            dashboardView.classList.add('active');
        });
    }

    const orderForm = document.getElementById('order-form');
    if (orderForm) {
        orderForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const amount = document.getElementById('invest-amount').value;
            
            // Populate payment view
            document.getElementById('payment-amount-display').textContent = `₹${parseInt(amount).toLocaleString('en-IN')}`;
            
            // Transition to payment view
            orderView.classList.add('hidden');
            orderView.classList.remove('active');
            paymentView.classList.remove('hidden');
            paymentView.classList.add('active');
            window.scrollTo(0, 0);
        });
    }

    const payBackBtn = document.getElementById('pay-back-btn');
    if (payBackBtn) {
        payBackBtn.addEventListener('click', () => {
            paymentView.classList.add('hidden');
            paymentView.classList.remove('active');
            orderView.classList.remove('hidden');
            orderView.classList.add('active');
        });
    }

    const payConfirmBtn = document.getElementById('pay-confirm-btn');
    if (payConfirmBtn) {
        payConfirmBtn.addEventListener('click', async () => {
            const btnText = document.getElementById('pay-btn-text');
            const spinner = document.getElementById('pay-spinner');
            const method = document.querySelector('input[name="payMethod"]:checked')?.value || 'UPI';
            const amount = document.getElementById('invest-amount').value;
            
            btnText.classList.add('hidden');
            spinner.classList.remove('hidden');
            payConfirmBtn.disabled = true;
            payBackBtn.disabled = true;

            try {
                // Save investment directly to database via API
                const response = await fetch('/api/portfolio/invest', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        fundId: currentCheckoutFund.id,
                        fundName: currentCheckoutFund.name,
                        category: currentCheckoutFund.category,
                        amount: Number(amount)
                    })
                });

                if (!response.ok) {
                    const errData = await response.json();
                    throw new Error(errData.error || 'Failed to save investment.');
                }

                alert(`🎉 Investment Successful!\nInvested ₹${Number(amount).toLocaleString('en-IN')} in ${currentCheckoutFund.name} via ${method}.`);
                
                // Reset UI & State
                orderForm.reset();
                currentCheckoutFund = null;
                
                // Return to Dashboard (Portfolio tab) & refresh data from DB
                paymentView.classList.add('hidden');
                paymentView.classList.remove('active');
                dashboardView.classList.remove('hidden');
                dashboardView.classList.add('active');
                switchTab('portfolio');
                await fetchAndRenderDashboard();
            } catch (err) {
                console.error('Payment/Investment error:', err);
                alert(`Error recording investment: ${err.message}`);
            } finally {
                btnText.classList.remove('hidden');
                spinner.classList.add('hidden');
                payConfirmBtn.disabled = false;
                payBackBtn.disabled = false;
            }
        });
    }

});
