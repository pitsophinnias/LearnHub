document.addEventListener('DOMContentLoaded', () => {
    // Check if user is authenticated
    const token = localStorage.getItem('adminToken');
    if (!token) {
        window.location.href = 'admin_login.html';
        return;
    }

    // Logout functionality
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('adminToken');
            window.location.href = 'admin_login.html';
        });
    }

    // WebSocket connection
    const ws = new WebSocket('ws://localhost:3000');
    
    ws.onopen = () => {
        console.log('WebSocket connected');
    };

    ws.onmessage = async (event) => {
    const notification = JSON.parse(event.data);
    console.log('Received notification:', notification);
    if (notification.isBrowserNotification) {
        if ('Notification' in window && Notification.permission !== 'denied') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    new Notification(notification.message);
                }
            });
        } else if (Notification.permission === 'granted') {
            new Notification(notification.message);
        }
    }
    if (notification.type === 'booking') {
        await loadBookings(); // Refresh bookings on new booking
    }
    showNotification(notification); 
};

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
        console.log('WebSocket disconnected');
    };

    // Fetch and display contacts
    async function loadContacts() {
    try {
        const response = await fetch('/api/contact', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.status === 401 || response.status === 403) {
            localStorage.removeItem('adminToken');
            window.location.href = 'admin_login.html';
            return;
        }
        const contacts = await response.json();
        console.log('Contacts data:', contacts);
        const contactTable = document.getElementById('contact-table'); // Ensure this ID exists
        contactTable.innerHTML = `
            <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Number</th>
                <th>Message</th>
                <th>Created At</th>
                <th>Action</th>
            </tr>
        `;
        if (contacts.length === 0) {
            contactTable.innerHTML += '<tr><td colspan="6">No contacts found</td></tr>';
        } else {
            contacts.forEach(contact => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${contact.id}</td><td>${contact.name}</td><td>${contact.number}</td><td>${contact.message}</td>
                    <td>${new Date(contact.created_at).toLocaleString()}</td>
                    <td><button class="delete-btn" data-type="contact" data-id="${contact.id}">Delete</button></td>
                `;
                contactTable.appendChild(row);
            });
        }
    } catch (error) {
        console.error('Error loading contacts:', error);
    }
}
    // Fetch and display bookings
    async function loadBookings() {
    try {
        const response = await fetch('/api/bookings', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.status === 401 || response.status === 403) {
            localStorage.removeItem('adminToken');
            window.location.href = 'admin_login.html';
            return;
        }
        const bookings = await response.json();
        console.log('Bookings data:', bookings); 
        const bookingTable = document.getElementById('booking-table');
        bookingTable.innerHTML = `
            <tr>
                <th>ID</th>
                <th>Tutor</th>
                <th>Subject</th>
                <th>User Number</th>
                <th>Schedule</th>
                <th>Created At</th>
                <th>Action</th>
            </tr>
        `;
        if (bookings.length === 0) {
            bookingTable.innerHTML += '<tr><td colspan="7">No bookings found</td></tr>';
        } else {
            bookings.forEach(booking => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${booking.id}</td><td>${booking.tutor_name || 'N/A'}</td><td>${booking.subject}</td><td>${booking.user_number}</td>
                    <td>${new Date(booking.schedule).toLocaleString()}</td><td>${new Date(booking.created_at).toLocaleString()}</td>
                    <td><button class="delete-btn" data-type="booking" data-id="${booking.id}">Delete</button></td>
                `;
                bookingTable.appendChild(row);
            });
        }
    } catch (error) {
        console.error('Error loading bookings:', error);
    }
}
            const bookings = await response.json();
            const bookingTable = document.getElementById('booking-table');
            bookingTable.innerHTML = `
                <tr>
                    <th>ID</th>
                    <th>Tutor</th>
                    <th>Subject</th>
                    <th>User Number</th>
                    <th>Schedule</th>
                    <th>Created At</th>
                    <th>Action</th>
                </tr>
            `;
            bookings.forEach(booking => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${booking.id}</td>
                    <td>${booking.tutor_name}</td>
                    <td>${booking.subject}</td>
                    <td>${booking.user_number}</td>
                    <td>${new Date(booking.schedule).toLocaleString()}</td>
                    <td>${new Date(booking.created_at).toLocaleString()}</td>
                    <td><button class="delete-btn" data-type="booking" data-id="${booking.id}">Delete</button></td>
                `;
                bookingTable.appendChild(row);
            });
        } catch (error) {
            console.error('Error loading bookings:', error);
        }
    }

    // Handle delete buttons
    document.addEventListener('click', async (e) => {
        if (e.target.classList.contains('delete-btn')) {
            const type = e.target.dataset.type;
            const id = e.target.dataset.id;
            
            if (confirm(`Are you sure you want to delete this ${type}?`)) {
                try {
                    const response = await fetch(`/api/${type}s/${id}`, {
                        method: 'DELETE',
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    });
                    if (response.status === 401 || response.status === 403) {
                        localStorage.removeItem('adminToken');
                        window.location.href = 'admin_login.html';
                        return;
                    }
                    if (response.ok) {
                        showNotification({ type: `${type}_deleted`, data: { id } });
                        if (type === 'contact') loadContacts();
                        if (type === 'booking') loadBookings();
                    } else {
                        const data = await response.json();
                        alert(`Error: ${data.error}`);
                    }
                } catch (error) {
                    console.error(`Error deleting ${type}:`, error);
                    alert(`Error deleting ${type}. Please try again.`);
                }
            }
        }
    });

    // Show notification
    function showNotification(notification) {
        const notificationDiv = document.createElement('div');
        notificationDiv.className = 'notification';
        let message = '';
        if (notification.type === 'contact') {
            message = `New contact message from ${notification.data.name}`;
        } else if (notification.type === 'booking') {
            message = `New booking for ${notification.data.subject} with ${notification.data.tutor_name}`;
        } else if (notification.type === 'contact_deleted') {
            message = `Contact message deleted`;
        } else if (notification.type === 'booking_deleted') {
            message = `Booking deleted`;
        }
        notificationDiv.innerHTML = `
            ${message}
            <span class="close">×</span>
        `;
        document.body.appendChild(notificationDiv);
        setTimeout(() => {
            notificationDiv.remove();
        }, 5000);
        notificationDiv.querySelector('.close').addEventListener('click', () => {
            notificationDiv.remove();
        });
    }

    // Load initial data
    loadContacts();
    ();
});
