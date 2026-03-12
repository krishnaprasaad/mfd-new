document.addEventListener('DOMContentLoaded', () => {
    const signupForm = document.getElementById('signup-page-form');
    const signupError = document.getElementById('reg-error');
    const signupContent = document.getElementById('signup-form-content');
    const successView = document.getElementById('signup-success-view');

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
