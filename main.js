// Removed mock database import

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const landingView = document.getElementById('landing-view');
    const dashboardView = document.getElementById('dashboard-view');
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
    const tabExplore = document.getElementById('tab-explore');
    const portfolioSection = document.getElementById('portfolio-section');
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
        const percentReturn = (absoluteReturn / portfolio.totalInvested) * 100;

        totalReturnsEl.textContent = formatCurrency(absoluteReturn);
        returnsPercentageEl.textContent = formatPercentage(percentReturn);

        // Style the returns based on positive/negative
        if (absoluteReturn >= 0) {
            returnsPercentageEl.classList.remove('negative');
        } else {
            returnsPercentageEl.classList.add('negative');
        }

        // Investments Table
        investmentsTbody.innerHTML = '';

        if (portfolio.investments.length === 0) {
            investmentsTbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No investments found.</td></tr>';
            return;
        }

        portfolio.investments.forEach(inv => {
            const absoluteInvReturn = inv.currentValue - inv.investedAmount;
            const isPositive = absoluteInvReturn >= 0;
            const pillClass = isPositive ? 'positive' : 'negative';
            const arrowSign = isPositive ? '▲' : '▼';

            const tr = document.createElement('tr');
            tr.innerHTML = `
        <td><div class="fund-name">${inv.name}</div></td>
        <td><div class="fund-category">${inv.category}</div></td>
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
                <button class="btn btn-primary full-width" onclick="alert('Proceeding to invest in ${fund.name} (Simulated)')">Invest Now</button>
            `;
            exploreFundsGrid.appendChild(card);
        });
    };

    // --- Tab Management ---
    const switchTab = (tabName) => {
        if (tabName === 'portfolio') {
            tabPortfolio.classList.add('active');
            tabExplore.classList.remove('active');
            portfolioSection.classList.add('active');
            portfolioSection.classList.remove('hidden');
            exploreSection.classList.remove('active');
            exploreSection.classList.add('hidden');
        } else if (tabName === 'explore') {
            tabExplore.classList.add('active');
            tabPortfolio.classList.remove('active');
            exploreSection.classList.add('active');
            exploreSection.classList.remove('hidden');
            portfolioSection.classList.remove('active');
            portfolioSection.classList.add('hidden');

            // Render funds if empty
            if (exploreFundsGrid.children.length === 0) {
                fetchExploreFunds();
            }
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
                signupSuccess.textContent = 'Account application received! Please wait 1-2 working days for your credentials to be sent to your email.';
                signupForm.reset();
                setTimeout(() => {
                    showLoginModal();
                    signupSuccess.textContent = ''; // Clear for next time
                }, 5000);
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
                contactSuccess.textContent = '✅ ' + data.message;
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
                meetingSuccess.textContent = '✅ ' + data.message;
                meetingForm.reset();
                setTimeout(() => meetingModal.classList.add('hidden'), 4000);
            } else {
                meetingError.textContent = data.error || 'Booking failed. Please try again.';
            }
        } catch (err) {
            meetingError.textContent = 'Network error. Please try again.';
        } finally {
            submitBtn.textContent = '📅 Schedule My Meeting';
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
    }
});
