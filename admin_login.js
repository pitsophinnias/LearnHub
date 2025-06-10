document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('admin-login-form');
    const loginError = document.getElementById('login-error');

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;

            try {
                const response = await fetch('/api/admin/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ username, password }),
                });

                const data = await response.json();

                if (response.ok) {
                    localStorage.setItem('adminToken', data.token);
                    window.location.href = 'admin.html';
                } else {
                    loginError.textContent = data.error || 'Invalid username or password';
                    loginError.style.display = 'block';
                }
            } catch (error) {
                console.error('Login error:', error);
                loginError.textContent = 'Error during login. Please try again.';
                loginError.style.display = 'block';
            }
        });
    }
});