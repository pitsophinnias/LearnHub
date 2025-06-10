const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
const WebSocket = require('ws');
const http = require('http');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const app = express();
const PORT = process.env.PORT || 3000;

// JWT Secret (store in environment variable in production)
const JWT_SECRET = 'your_jwt_secret_key'; // Change to a secure key

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use('/images', express.static(path.join(__dirname, 'images')));
app.use(express.static(path.join(__dirname, '.')));

// Authentication middleware
const authenticateToken = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Access denied' });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        console.error('Token verification error:', error);
        res.status(403).json({ error: 'Invalid token' });
    }
};

// PostgreSQL Connection
const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'learnhub',
    password: process.env.DB_PASSWORD || 'phinnias27',
    port: process.env.DB_PORT || 5432,
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:phinnias27@localhost:5432/learnhub',
});

pool.connect((err, client, release) => {
    if (err) {
        console.error('Database connection error:', err.stack);
    } else {
        console.log('Database connected successfully');
        release();
    }
});

// Create HTTP server and WebSocket server
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Store connected WebSocket clients
const clients = new Set();

// Handle WebSocket connections
wss.on('connection', (ws, req) => {
    console.log(`WebSocket client connected from ${req.socket.remoteAddress}:${req.socket.remotePort}`);
    clients.add(ws);

    ws.on('message', (data) => {
        console.log('WebSocket message received:', data.toString());
    });

    ws.on('close', (code, reason) => {
        console.log(`WebSocket client disconnected: code=${code}, reason=${reason}`);
        clients.delete(ws);
    });

    ws.on('error', (error) => {
        console.error('WebSocket server error:', error);
        clients.delete(ws);
    });
});

wss.on('error', (error) => {
    console.error('WebSocket server error:', error);
});

// Function to broadcast notifications
function broadcastNotification(message) {
    console.log('Broadcasting notification:', message);
    let clientCount = 0;
    clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            try {
                client.send(JSON.stringify(message));
                clientCount++;
            } catch (error) {
                console.error('Error sending to client:', error);
                clients.delete(client);
            }
        }
    });
    console.log(`Notification sent to ${clientCount} clients`);
}

// Admin Registration Endpoint
app.post('/api/admin/register', async (req, res) => {
    try {
        const { tutorId, username, password } = req.body;
        console.log('Admin registration attempt:', { tutorId, username });

        // Validate tutor ID exists
        const tutorResult = await pool.query('SELECT id FROM tutors WHERE id = $1', [tutorId]);
        if (tutorResult.rows.length === 0) {
            console.log('Tutor not found:', tutorId);
            return res.status(400).json({ error: 'Invalid tutor ID' });
        }

        // Check if username already exists
        const existingUser = await pool.query('SELECT id FROM admin_users WHERE username = $1', [username]);
        if (existingUser.rows.length > 0) {
            console.log('Username already exists:', username);
            return res.status(400).json({ error: 'Username already exists' });
        }

        // Hash password
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Insert new admin user
        const result = await pool.query(
            'INSERT INTO admin_users (tutor_id, username, password_hash) VALUES ($1, $2, $3) RETURNING id, username',
            [tutorId, username, passwordHash]
        );

        console.log('Admin registered:', result.rows[0]);
        res.status(201).json({ message: 'Registration successful' });
    } catch (error) {
        console.error('Error during registration:', error.message);
        res.status(500).json({ error: 'Error during registration' });
    }
});

// Admin Login Endpoint
app.post('/api/admin/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        console.log('Admin login attempt:', { username });

        const result = await pool.query('SELECT * FROM admin_users WHERE username = $1', [username]);
        const admin = result.rows[0];

        if (!admin) {
            console.log('Admin not found:', username);
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        const isMatch = await bcrypt.compare(password, admin.password_hash);
        if (!isMatch) {
            console.log('Invalid password for:', username);
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        const token = jwt.sign({ id: admin.id, username: admin.username }, JWT_SECRET, { expiresIn: '1h' });
        console.log('Admin logged in:', username);
        res.status(200).json({ token });
    } catch (error) {
        console.error('Error during login:', error.message);
        res.status(500).json({ error: 'Error during login' });
    }
});

// Contact Form Endpoint
app.post('/api/contact', async (req, res) => {
    try {
        console.log('Raw request body:', req.body);
        const { name, number, message } = req.body;
        console.log('Received contact form:', { name, number, message });
        const result = await pool.query(
            'INSERT INTO contacts (name, number, message) VALUES ($1, $2, $3) RETURNING *',
            [name, number, message]
        );
        console.log('Contact saved:', result.rows[0]);
        // Broadcast notification
        broadcastNotification({
            type: 'contact',
            data: { id: result.rows[0].id, name, number, message, created_at: result.rows[0].created_at }
        });
        res.status(200).json({ message: 'Message saved successfully', data: result.rows[0] });
    } catch (error) {
        console.error('Error saving message:', error.message);
        res.status(500).json({ error: 'Error saving message' });
    }
});

// Get All Contact Messages (Protected)
app.get('/api/contacts', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM contacts ORDER BY created_at DESC');
        console.log('Contacts found:', result.rows);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error fetching contacts:', error.message);
        res.status(500).json({ error: 'Error fetching contacts' });
    }
});

// Delete Contact (Protected)
app.delete('/api/contacts/:number', authenticateToken, async (req, res) => {
    try {
        const { number } = req.params;
        console.log('Attempting to delete contact:', { number });
        const result = await pool.query('DELETE FROM contacts WHERE number = $1 RETURNING *', [number]);
        if (result.rows.length === 0) {
            console.log('Contact not found:', number);
            return res.status(404).json({ error: 'Contact not found' });
        }
        console.log('Contact deleted:', result.rows[0]);
        // Broadcast deletion notification
        broadcastNotification({
            type: 'contact_deleted',
            data: { number }
        });
        res.status(200).json({ message: 'Contact deleted successfully' });
    } catch (error) {
        console.error('Error deleting contact:', error.message);
        res.status(500).json({ error: 'Error deleting contact' });
    }
});

// Get Tutors by Subject
app.get('/api/tutors/:subject', async (req, res) => {
    try {
        const subject = req.params.subject.toLowerCase();
        console.log('Fetching tutors for:', subject);
        const result = await pool.query(
            'SELECT * FROM tutors WHERE subjects ? $1',
            [subject]
        );
        console.log('Tutors found:', result.rows);
        if (result.rows.length === 0) {
            console.log(`No tutors found for subject: ${subject}`);
        }
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error fetching tutors:', error.message);
        res.status(500).json({ error: 'Error fetching tutors' });
    }
});

// Create Booking
app.post('/api/bookings', async (req, res) => {
    try {
        const { tutorId, subject, userNumber, schedule } = req.body;
        console.log('Received booking:', { tutorId, subject, userNumber, schedule });
        const result = await pool.query(
            'INSERT INTO bookings (tutor_id, subject, user_number, schedule) VALUES ($1, $2, $3, $4) RETURNING *',
            [tutorId, subject, userNumber, schedule]
        );
        console.log('Booking created:', result.rows[0]);
        // Fetch tutor name for notification
        const tutorResult = await pool.query('SELECT name FROM tutors WHERE id = $1', [tutorId]);
        const tutorName = tutorResult.rows[0]?.name || 'Unknown Tutor';
        // Broadcast notification
        broadcastNotification({
            type: 'booking',
            data: {
                id: result.rows[0].id,
                tutor_name: tutorName,
                subject,
                user_number: userNumber,
                schedule: result.rows[0].schedule,
                created_at: result.rows[0].created_at
            }
        });
        res.status(200).json({ message: 'Booking created successfully', data: result.rows[0] });
    } catch (error) {
        console.error('Error creating booking:', error.message);
        res.status(500).json({ error: 'Error creating booking' });
    }
});

// Get All Bookings (Protected)
app.get('/api/bookings', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT b.*, t.name AS tutor_name FROM bookings b JOIN tutors t ON b.tutor_id = t.id ORDER BY b.created_at DESC'
        );
        console.log('Bookings found:', result.rows);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error fetching bookings:', error.message);
        res.status(500).json({ error: 'Error fetching bookings' });
    }
});

// Delete Booking (Protected)
app.delete('/api/bookings/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        console.log('Attempting to delete booking:', { id });
        const result = await pool.query('DELETE FROM bookings WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) {
            console.log('Booking not found:', id);
            return res.status(404).json({ error: 'Booking not found' });
        }
        console.log('Booking deleted:', result.rows[0]);
        // Broadcast deletion notification
        broadcastNotification({
            type: 'booking_deleted',
            data: { id }
        });
        res.status(200).json({ message: 'Booking deleted successfully' });
    } catch (error) {
        console.error('Error deleting booking:', error.message);
        res.status(500).json({ error: 'Error deleting booking' });
    }
});

// Start the server
server.listen(PORT,'0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
