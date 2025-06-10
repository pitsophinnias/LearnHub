document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('admin-register-form');
    const registerError = document.getElementById('register-error');

    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const tutorId = document.getElementById('tutor-id').value;
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirm-password').value;

            if (password !== confirmPassword) {
                registerError.textContent = 'Passwords do not match';
                registerError.style.display = 'block';
                return;
            }

            try {
                const response = await fetch('/api/admin/register', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ tutorId, username, password }),
                });

                const data = await response.json();

                if (response.ok) {
                    alert('Registration successful! Please login.');
                    window.location.href = 'admin_login.html';
                } else {
                    registerError.textContent = data.error || 'Error during registration';
                    registerError.style.display = 'block';
                }
            } catch (error) {
                console.error('Registration error:', error);
                registerError.textContent = 'Error during registration. Please try again.';
                registerError.style.display = 'block';
            }
        });
    }
});