const SERVICES = [
    { icon: '🛡️', name: 'Insurance Claims', duration: '30 mins' },
    { icon: '👤', name: 'Individual Insurance Planning', duration: '30 mins' },
    { icon: '🏢', name: 'Corporate Insurance Planning', duration: '30 mins' },
    { icon: '🤝', name: 'Business Associate', duration: '30 mins' },
    { icon: '📊', name: 'Financial Planning', duration: '30 mins' },
    { icon: '💹', name: 'Mutual Fund Investment Planning', duration: '30 mins' },
    { icon: '📜', name: 'Transmission of Shares & Mutual Funds / Demat', duration: '30 mins' },
    { icon: '🏦', name: 'Bonds / FD / NCD (Fixed Income)', duration: '30 mins' },
    { icon: '🏛️', name: 'National Pension Scheme (NPS)', duration: '30 mins' },
];

let selectedService = null;

// --- Render service cards ---
const grid = document.getElementById('services-grid');
const nextBtn = document.getElementById('next-btn');

SERVICES.forEach((svc, idx) => {
    const card = document.createElement('div');
    card.className = 'service-card';
    card.innerHTML = `
        <div class="service-selected-check">✓</div>
        <div class="service-icon">${svc.icon}</div>
        <div class="service-name">${svc.name}</div>
        <div class="service-duration">⏱ ${svc.duration}</div>
    `;
    card.addEventListener('click', () => {
        document.querySelectorAll('.service-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        selectedService = svc;
        nextBtn.disabled = false;
    });
    grid.appendChild(card);
});

// --- Step navigation ---
nextBtn.addEventListener('click', () => {
    if (!selectedService) return;

    // Update badge in step 2
    document.getElementById('badge-icon').textContent = selectedService.icon;
    document.getElementById('badge-service-name').textContent = selectedService.name;
    document.getElementById('success-service-name').textContent = selectedService.name;

    // Switch steps
    document.getElementById('step-1').classList.remove('active');
    document.getElementById('step-2').classList.add('active');

    // Update step pills
    document.getElementById('step-pill-1').classList.remove('active');
    document.getElementById('step-pill-1').classList.add('done');
    document.getElementById('step-pill-2').classList.add('active');

    window.scrollTo({ top: 0, behavior: 'smooth' });
});

document.getElementById('change-service-btn').addEventListener('click', () => {
    document.getElementById('step-2').classList.remove('active');
    document.getElementById('step-1').classList.add('active');
    document.getElementById('step-pill-2').classList.remove('active');
    document.getElementById('step-pill-1').classList.add('active');
    document.getElementById('step-pill-1').classList.remove('done');
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

// --- Form submission ---
document.getElementById('booking-details-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('book-name').value.trim();
    const email = document.getElementById('book-email').value.trim();
    const phone = document.getElementById('book-phone').value.trim();
    const preferredTime = document.getElementById('book-time').value.trim();
    const bookError = document.getElementById('book-error');

    bookError.textContent = '';

    const submitBtn = document.getElementById('book-submit-btn');
    submitBtn.textContent = 'Booking...';
    submitBtn.disabled = true;

    try {
        const response = await fetch('/api/meeting', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                serviceType: selectedService.name,
                name, email, phone, preferredTime
            })
        });

        const data = await response.json();

        if (response.ok) {
            // Show success screen
            document.getElementById('step-2').classList.remove('active');
            const successScreen = document.getElementById('success-screen');
            successScreen.classList.add('active');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            bookError.textContent = data.error || 'Booking failed. Please try again.';
        }
    } catch (err) {
        bookError.textContent = 'Network error. Please try again.';
    } finally {
        submitBtn.textContent = '✅ Confirm Appointment';
        submitBtn.disabled = false;
    }
});
