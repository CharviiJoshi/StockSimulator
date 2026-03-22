/**
 * Forgot Password Interaction Logic
 */

document.addEventListener('DOMContentLoaded', () => {

    const form = document.getElementById('forgotPasswordForm');
    const submitBtn = document.querySelector('.submit-action-button');
    const subheading = document.querySelector('.form-subheading');

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            // UI Feedback
            submitBtn.textContent = 'Verifying Account...';
            submitBtn.disabled = true;

            try {
                const formData = new FormData(form);
                const email = formData.get('email');

                if (!email) {
                    submitBtn.textContent = 'Send Recovery Link';
                    submitBtn.disabled = false;
                    return;
                }

                // Simulate network latency (humanized feel)
                await new Promise(resolve => setTimeout(resolve, 800));

                // Success State Transition
                submitBtn.textContent = 'Recovery Link Sent!';
                submitBtn.style.backgroundColor = '#059669'; // Success green
                submitBtn.style.boxShadow = 'none';

                // Hide the form input and just show a success message in the subheading
                form.querySelector('.form-group').style.display = 'none';
                subheading.innerHTML = `If an account exists for <strong style="color: #f8fafc;">${email}</strong>, you will receive password reset instructions shortly.`;

                // Change button functionality to act as a "Return" button
                setTimeout(() => {
                    submitBtn.textContent = 'Return to Login';
                    submitBtn.style.backgroundColor = '#10b981'; // Revert to brand green
                    submitBtn.disabled = false;

                    // Now clicking it redirects instead of submitting
                    submitBtn.type = 'button';
                    submitBtn.addEventListener('click', () => {
                        window.location.href = 'login.html';
                    }, { once: true });
                }, 1500);

            } catch (error) {
                console.error('Password reset failed:', error);
                submitBtn.textContent = 'Connection Error';
                submitBtn.style.backgroundColor = '#dc2626'; // Red
            }
        });
    }
});
