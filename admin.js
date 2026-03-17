document.addEventListener('DOMContentLoaded', () => {
    // Determine which page we are on
    const loginForm = document.getElementById('admin-login-form');
    const dashboardContainer = document.querySelector('.admin-dashboard-container');

    if (loginForm) {
        handleLogin(loginForm);
    }

    if (dashboardContainer) {
        loadDashboardData();
        handleLogout();
    }
});

async function handleLogin(form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const errorDiv = document.getElementById('login-error');
        const submitBtn = document.getElementById('login-btn');
        
        errorDiv.textContent = '';
        const username = form.username.value;
        const password = form.password.value;

        try {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Verifying...';

            const response = await fetch('/api/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Login failed');
            }

            // Redirect to dashboard
            window.location.href = '/admin-dashboard.html';
        } catch (err) {
            errorDiv.textContent = err.message;
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Secure Login';
        }
    });
}

function handleLogout() {
    const logoutBtn = document.getElementById('admin-logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await fetch('/api/admin/logout', { method: 'POST' });
            window.location.href = '/admin-login.html';
        });
    }
}

async function loadDashboardData() {
    try {
        const response = await fetch('/api/admin/data');
        
        if (response.status === 401) {
            window.location.href = '/admin-login.html';
            return;
        }

        const resData = await response.json();
        const { stats, data } = resData;

        // Update Stats
        document.getElementById('count-applications').textContent = stats.applications;
        document.getElementById('count-meetings').textContent = stats.meetings;
        document.getElementById('count-contacts').textContent = stats.contacts;
        document.getElementById('count-users').textContent = stats.users;

        // Populate Applications Table
        const appTable = document.getElementById('table-applications');
        appTable.innerHTML = data.applications.length ? data.applications.map(app => `
            <tr>
                <td><strong>${app.salutation} ${app.fullName}</strong></td>
                <td>${app.position}</td>
                <td>${app.location}</td>
                <td><span class="admin-badge">${app.status}</span></td>
                <td>${new Date(app.createdAt).toLocaleDateString()}</td>
                <td><a href="/${app.resume}" target="_blank" style="color: var(--colorAccent);">View Resume</a></td>
            </tr>
        `).join('') : '<tr><td colspan="6" style="text-align:center; padding: 2rem;">No applications found.</td></tr>';

        // Populate Meetings Table
        const meetingTable = document.getElementById('table-meetings');
        meetingTable.innerHTML = data.meetings.length ? data.meetings.map(m => `
            <tr>
                <td>${m.name}</td>
                <td>${m.email}</td>
                <td>${m.phone}</td>
                <td>${m.preferredTime || 'Not specified'}</td>
                <td>${new Date(m.createdAt).toLocaleDateString()}</td>
            </tr>
        `).join('') : '<tr><td colspan="5" style="text-align:center; padding: 2rem;">No meetings found.</td></tr>';

        // Populate Contacts Table
        const contactTable = document.getElementById('table-contacts');
        contactTable.innerHTML = data.contacts.length ? data.contacts.map(c => `
            <tr>
                <td>${c.name}</td>
                <td>${c.email}</td>
                <td>${c.message.substring(0, 50)}...</td>
                <td>${new Date(c.createdAt).toLocaleDateString()}</td>
            </tr>
        `).join('') : '<tr><td colspan="4" style="text-align:center; padding: 2rem;">No inquiries found.</td></tr>';

        // Populate Users Table
        const userTable = document.getElementById('table-users');
        userTable.innerHTML = data.users.length ? data.users.map(u => `
            <tr>
                <td>${u.name}</td>
                <td>${u.email}</td>
                <td>${u.pan}</td>
                <td>${u.phone}</td>
                <td>${new Date(u.createdAt).toLocaleDateString()}</td>
            </tr>
        `).join('') : '<tr><td colspan="5" style="text-align:center; padding: 2rem;">No registered users found.</td></tr>';

    } catch (err) {
        console.error('Error loading admin data:', err);
    }
}
