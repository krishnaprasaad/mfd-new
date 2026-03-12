document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const signupForm = document.getElementById('signup-page-form');
    const signupError = document.getElementById('reg-error');
    const signupContent = document.getElementById('signup-form-content');
    const successView = document.getElementById('signup-success-view');

    // Step Elements
    const step1 = document.getElementById('step-1');
    const step2 = document.getElementById('step-2');
    const nextBtn = document.getElementById('next-step-btn');
    const prevBtn = document.getElementById('prev-step-btn');
    const dot1 = document.getElementById('dot-1');
    const dot2 = document.getElementById('dot-2');
    const helperText = document.getElementById('step-helper-text');

    // --- Step Navigation ---
    nextBtn.addEventListener('click', () => {
        // Simple client-side validation for Step 1
        const name = document.getElementById('reg-name').value.trim();
        const email = document.getElementById('reg-email').value.trim();
        const phone = document.getElementById('reg-phone').value.trim();

        if (!name || !email || !phone) {
            signupError.textContent = 'Please fill in all details in Step 1.';
            return;
        }

        signupError.textContent = '';
        step1.classList.remove('active');
        step2.classList.add('active');
        dot1.classList.remove('active');
        dot2.classList.add('active');
        helperText.textContent = 'Step 2 of 2: KYC Details';
    });

    prevBtn.addEventListener('click', () => {
        step2.classList.remove('active');
        step1.classList.add('active');
        dot2.classList.remove('active');
        dot1.classList.add('active');
        helperText.textContent = 'Step 1 of 2: Basic Information';
    });

    // --- Form Submission ---
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('reg-name').value.trim();
        const email = document.getElementById('reg-email').value.trim();
        const phone = document.getElementById('reg-phone').value.trim();
        const pan = document.getElementById('reg-pan').value.trim().toUpperCase();
        const dob = document.getElementById('reg-dob').value;

        signupError.textContent = '';

        const submitBtn = document.getElementById('reg-submit-btn');
        submitBtn.textContent = 'Processing...';
        submitBtn.disabled = true;

        try {
            const response = await fetch('/api/auth/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, phone, pan, dob })
            });

            const data = await response.json();

            if (response.ok) {
                signupContent.style.display = 'none';
                successView.classList.add('active');
            } else {
                signupError.textContent = data.error || 'Failed to create account.';
            }
        } catch (error) {
            console.error('Signup error:', error);
            signupError.textContent = 'A network error occurred. Please try again.';
        } finally {
            submitBtn.textContent = 'Create Account';
            submitBtn.disabled = false;
        }
    });
});
