document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('adminToken');
    const ws = new WebSocket(`ws${window.location.protocol === 'https:' ? 's' : ''}://${window.location.host}`);
    let adminId = null;

    // Redirect to login if no token
    if (!token) {
        window.location.href = 'admin_login.html';
        return;
    }

    // Decode token to get admin ID (assuming JWT contains id)
    try {
        const decoded = JSON.parse(atob(token.split('.')[1]));
        adminId = decoded.id;
    } catch (error) {
        console.error('Error decoding token:', error);
        localStorage.removeItem('adminToken');
        window.location.href = 'admin_login.html';
        return;
    }

    // WebSocket setup
    ws.onopen = () => {
        console.log('WebSocket connected on admin');
        ws.send(JSON.stringify({ type: 'admin_login', adminId }));
    };

    ws.onmessage = (event) => {
        const notification = JSON.parse(event.data);
        console.log('Received notification:', notification);
        if (notification.isBrowserNotification) {
            showNotification(notification.message);
            if (notification.type === 'booking' || notification.type === 'booking_deleted') {
                fetchBookings();
            } else if (notification.type === 'contact' || notification.type === 'contact_deleted') {
                fetchContacts();
            }
        }
    };

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
        console.log('WebSocket disconnected');
    };

    // Show browser notification
    function showNotification(message) {
        if ('Notification' in window && Notification.permission !== 'denied') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    new Notification('LearnHub Admin', { body: message });
                }
            });
        } else if (Notification.permission === 'granted') {
            new Notification('LearnHub Admin', { body: message });
        }

        // Also show on-page notification
        const notificationDiv = document.createElement('div');
        notificationDiv.className = 'notification';
        notificationDiv.innerHTML = `${message} <span class="close">×</span>`;
        document.body.appendChild(notificationDiv);

        notificationDiv.querySelector('.close').addEventListener('click', () => {
            notificationDiv.remove();
        });

        setTimeout(() => {
            if (notificationDiv.parentNode) {
                notificationDiv.remove();
            }
        }, 5000);
    }

    // Fetch and display bookings
    async function fetchBookings() {
        try {
            console.log('Fetching bookings with token:', token.substring(0, 10) + '...'); // Debug token (partial)
            const response = await fetch('/api/bookings', {
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (response.status === 401 || response.status === 403) {
                console.log('Unauthorized or Forbidden response:', response.status);
                const errorData = await response.json();
                console.log('Error details:', errorData);
                localStorage.removeItem('adminToken');
                showNotification('Session expired or invalid token. Please log in again.');
                window.location.href = 'admin_login.html';
                return;
            }
            if (!response.ok) {
                const errorData = await response.json();
                console.log('Server error details:', errorData);
                throw new Error(`HTTP error! status: ${response.status}, details: ${errorData.error || 'Unknown'}`);
            }
            const bookings = await response.json();
            console.log('Bookings received:', bookings);
            const tbody = document.querySelector('#bookings-table tbody');
            tbody.innerHTML = '';
            if (!Array.isArray(bookings)) {
                console.warn('Bookings response is not an array:', bookings);
                showNotification('No bookings available.');
                return;
            }
            if (bookings.length === 0) {
                showNotification('No bookings found.');
            }
            bookings.forEach(booking => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${booking.id}</td>
                    <td>${booking.tutor_name || 'Unknown'}</td>
                    <td>${booking.subject}</td>
                    <td>${booking.user_number}</td>
                    <td>${new Date(booking.schedule).toLocaleString()}</td>
                    <td>${new Date(booking.created_at).toLocaleString()}</td>
                    <td><button class="delete-btn" data-type="booking" data-id="${booking.id}">Delete</button></td>
                `;
                tbody.appendChild(row);
            });
        } catch (error) {
            console.error('Error fetching bookings:', error);
            showNotification('Error fetching bookings: ' + error.message);
        }
    }

    // Fetch and display contacts
    async function fetchContacts() {
        try {
            const response = await fetch('/api/contacts', {
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (response.status === 401 || response.status === 403) {
                localStorage.removeItem('adminToken');
                window.location.href = 'admin_login.html';
                return;
            }
            const contacts = await response.json();
            const tbody = document.querySelector('#contacts-table tbody');
            tbody.innerHTML = '';
            contacts.forEach(contact => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${contact.name}</td>
                    <td>${contact.number}</td>
                    <td>${contact.message}</td>
                    <td>${new Date(contact.created_at).toLocaleString()}</td>
                    <td><button class="delete-btn" data-type="contact" data-id="${contact.number}">Delete</button></td>
                `;
                tbody.appendChild(row);
            });
        } catch (error) {
            console.error('Error fetching contacts:', error);
            showNotification('Error fetching contacts');
        }
    }

    // Handle delete button clicks
    document.addEventListener('click', async (e) => {
        if (e.target.classList.contains('delete-btn')) {
            const type = e.target.getAttribute('data-type');
            const id = e.target.getAttribute('data-id');
            const password = prompt('Enter delete password:');
            if (!password) return;

            try {
                const verifyResponse = await fetch('/api/verify-delete-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password }),
                });
                const verifyData = await verifyResponse.json();
                if (!verifyResponse.ok) {
                    alert(`Error: ${verifyData.error}`);
                    return;
                }

                const endpoint = type === 'booking' ? `/api/bookings/${id}` : `/api/contacts/${id}`;
                const response = await fetch(endpoint, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` },
                });
                const data = await response.json();
                if (response.ok) {
                    showNotification(`${type.charAt(0).toUpperCase() + type.slice(1)} deleted successfully`);
                    if (type === 'booking') fetchBookings();
                    else fetchContacts();
                } else {
                    alert(`Error: ${data.error}`);
                }
            } catch (error) {
                console.error('Error deleting:', error);
                alert('Error deleting record');
            }
        }
    });

    // Logout
    document.getElementById('logout-btn').addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem('adminToken');
        ws.close();
        window.location.href = 'admin_login.html';
    });

    // Smooth scrolling for navigation
    document.querySelectorAll('nav a:not(#logout-btn)').forEach(anchor => {
        anchor.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = anchor.getAttribute('href');
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                window.scrollTo({
                    top: targetElement.offsetTop - 70,
                    behavior: 'smooth'
                });
            }
        });
    });

    // Initial fetch
    fetchBookings();
    fetchContacts();
});