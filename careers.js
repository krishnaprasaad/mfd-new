document.addEventListener('DOMContentLoaded', () => {
    const careersForm = document.getElementById('careers-form');
    const submitBtn = document.getElementById('careers-submit-btn');
    const errorDiv = document.getElementById('careers-error');
    const successDiv = document.getElementById('careers-success');

    if (careersForm) {
        careersForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Reset messages
            errorDiv.textContent = '';
            successDiv.textContent = '';
            
            // Get form values for validation
            const salutation = document.getElementById('salutation').value;
            const fullName = document.getElementById('fullName').value.trim();
            const email = document.getElementById('email').value.trim();
            const phone = document.getElementById('phone').value.trim();
            const position = document.getElementById('position').value;
            const location = document.getElementById('location').value.trim();
            const resumeInput = document.getElementById('resume');
            const message = document.getElementById('message').value.trim();
            const consent = document.getElementById('consent').checked;
            
            // Basic frontend validation
            if (!salutation || !fullName || !email || !phone || !position || !location || !message || !resumeInput.files[0]) {
                errorDiv.textContent = 'Please fill out all required fields and upload your resume.';
                return;
            }

            if (!consent) {
                errorDiv.textContent = 'You must agree to the data collection policy to submit your application.';
                return;
            }

            try {
                // Determine API URL based on environment (development vs production)
                // Use relative path which works for both local dev server and Vercel/Netlify if mounted on same domain
                const apiUrl = '/api/careers/apply';
                
                // Set loading state
                const originalBtnText = submitBtn.textContent;
                submitBtn.textContent = 'Submitting...';
                submitBtn.disabled = true;

                // Create FormData payload
                const formData = new FormData(careersForm);

                const response = await fetch(apiUrl, {
                    method: 'POST',
                    body: formData
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || 'Failed to submit application');
                }

                // Success
                successDiv.textContent = data.message || 'Application submitted successfully! We will be in touch soon.';
                careersForm.reset();
                
                // Clear success message after 5 seconds
                setTimeout(() => {
                    successDiv.textContent = '';
                }, 5000);

            } catch (error) {
                console.error('Application Error:', error);
                errorDiv.textContent = error.message;
            } finally {
                // Restore button state
                submitBtn.textContent = 'Submit Application';
                submitBtn.disabled = false;
            }
        });
    }
});

// Global function to handle "Apply Now" clicks from job cards
window.scrollToJob = (jobTitle) => {
    const formSection = document.getElementById('careers-form');
    const positionSelect = document.getElementById('position');
    
    if (formSection && positionSelect) {
        // Find the option that matches the job title (roughly)
        for (let i = 0; i < positionSelect.options.length; i++) {
            if (positionSelect.options[i].value.includes(jobTitle)) {
                positionSelect.selectedIndex = i;
                break;
            }
        }
        
        // Smooth scroll to form
        formSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Visual feedback on the select element
        positionSelect.parentElement.style.animation = 'pulse 1s ease';
        setTimeout(() => {
            positionSelect.parentElement.style.animation = '';
        }, 1000);
    }
};
