import { mockDatabase } from './data.js';

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const landingView = document.getElementById('landing-view');
    const dashboardView = document.getElementById('dashboard-view');
    const loginModal = document.getElementById('login-modal');

    const navLoginBtn = document.getElementById('nav-login-btn');
    const navLogoutBtn = document.getElementById('nav-logout-btn');
    const heroLoginBtn = document.getElementById('hero-login-btn');
    const modalCloseBtn = document.getElementById('modal-close-btn');

    const loginForm = document.getElementById('login-form');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const loginError = document.getElementById('login-error');

    // Dashboard Elements
    const userNameDisplay = document.getElementById('user-name-display');
    const totalInvestedEl = document.getElementById('total-invested');
    const currentValueEl = document.getElementById('current-value');
    const totalReturnsEl = document.getElementById('total-returns');
    const returnsPercentageEl = document.getElementById('returns-percentage');
    const investmentsTbody = document.getElementById('investments-tbody');

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
    };

    const hideLoginModal = () => {
        loginModal.classList.add('hidden');
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

    // --- Authentication Actions ---
    const handleLogin = (e) => {
        e.preventDefault();
        const email = emailInput.value.trim();
        const password = passwordInput.value;

        const userRecord = mockDatabase[email];

        // Artificial delay for loading effect
        const submitBtn = loginForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Authenticating...';
        submitBtn.disabled = true;

        setTimeout(() => {
            if (userRecord && userRecord.password === password) {
                // Success
                currentUser = userRecord;
                hideLoginModal();
                renderDashboard(currentUser);
                showDashboard();
            } else {
                // Failure
                loginError.textContent = 'Invalid email or password.';
            }
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }, 600); // 600ms fake delay
    };

    const handleLogout = () => {
        currentUser = null;
        showLanding();
    };

    // --- Event Listeners ---
    navLoginBtn.addEventListener('click', showLoginModal);
    heroLoginBtn.addEventListener('click', showLoginModal);
    modalCloseBtn.addEventListener('click', hideLoginModal);

    // Close modal when clicking outside
    loginModal.addEventListener('click', (e) => {
        if (e.target === loginModal) hideLoginModal();
    });

    loginForm.addEventListener('submit', handleLogin);
    navLogoutBtn.addEventListener('click', handleLogout);

    // Initialize view
    showLanding();
});
