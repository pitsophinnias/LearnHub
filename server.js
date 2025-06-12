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

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';
const DELETE_PASSWORD_HASH = '$2b$10$9k3Qz8J8k2j3m4n5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2g3';

app.use(cors());
app.use(bodyParser.json());
app.use('/images', express.static(path.join(__dirname, 'images')));
app.use(express.static(path.join(__dirname, '.')));

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

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
});

async function testDatabaseConnection() {
    let retries = 5;
    while (retries > 0) {
        try {
            const client = await pool.connect();
            console.log('Database connected successfully');
            await client.query('SELECT NOW()');
            client.release();
            return;
        } catch (err) {
            console.error(`Database connection attempt failed (${retries} retries left):`, err.message, err.stack);
            retries--;
            if (retries === 0) {
                console.error('Failed to connect to database after retries');
                process.exit(1);
            }
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
}

testDatabaseConnection();

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const adminClients = new Map();

wss.on('connection', (ws, req) => {
    console.log(`WebSocket client connected from ${req.socket.remoteAddress}:${req.socket.remotePort}`);
    ws.isAdmin = false;
    ws.adminId = null;

    ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'admin_login' && message.adminId) {
            ws.isAdmin = true;
            ws.adminId = message.adminId;
            adminClients.set(message.adminId, ws);
            console.log(`Admin ${message.adminId} registered with WebSocket`);
        }
    });

    ws.on('close', (code, reason) => {
        console.log(`WebSocket client disconnected: code=${code}, reason=${reason}`);
        if (ws.isAdmin && ws.adminId) {
            adminClients.delete(ws.adminId);
        }
        clients.delete(ws);
    });

    ws.on('error', (error) => {
        console.error('WebSocket server error:', error);
        if (ws.isAdmin && ws.adminId) {
            adminClients.delete(ws.adminId);
        }
        clients.delete(ws);
    });
});

wss.on('error', (error) => {
    console.error('WebSocket server error:', error);
});

const clients = new Set();

function broadcastNotification(type) {
    console.log('Broadcasting notification:', type);
    let clientCount = 0;
    adminClients.forEach((ws, adminId) => {
        if (ws.readyState === WebSocket.OPEN) {
            try {
                const notification = {
                    type: type,
                    message: type === 'booking' ? 'New booking' : type === 'contact' ? 'New message' : type.includes('deleted') ? `${type.replace('_deleted', '')} deleted` : 'Notification',
                    isBrowserNotification: true
                };
                ws.send(JSON.stringify(notification));
                clientCount++;
            } catch (error) {
                console.error(`Error sending to admin ${adminId}:`, error);
                adminClients.delete(adminId);
            }
        }
    });
    console.log(`Notification sent to ${clientCount} admin clients`);
}

app.post('/api/verify-delete-password', async (req, res) => {
    try {
        const { password } = req.body;
        const isMatch = await bcrypt.compare(password, DELETE_PASSWORD_HASH);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid delete password' });
        }
        res.status(200).json({ message: 'Password verified' });
    } catch (error) {
        console.error('Error verifying delete password:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/admin/register', async (req, res) => {
    try {
        const { tutorId, username, password } = req.body;
        console.log('Admin registration attempt:', { tutorId, username });

        const tutorResult = await pool.query('SELECT id FROM tutors WHERE id = $1', [tutorId]);
        if (tutorResult.rows.length === 0) {
            console.log('Tutor not found:', tutorId);
            return res.status(400).json({ error: 'Invalid tutor ID' });
        }

        const existingUser = await pool.query('SELECT id FROM admin_users WHERE username = $1', [username]);
        if (existingUser.rows.length > 0) {
            console.log('Username already exists:', username);
            return res.status(400).json({ error: 'Username already exists' });
        }

        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

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

app.post('/api/contact', async (req, res) => {
    try {
        const { name, number, message } = req.body;
        console.log('Received contact form:', { name, number, message });
        const result = await pool.query(
            'INSERT INTO contacts (name, number, message) VALUES ($1, $2, $3) RETURNING *',
            [name, number, message]
        );
        console.log('Contact saved:', result.rows[0]);
        broadcastNotification('contact');
        res.status(200).json({ message: 'Message saved successfully', data: result.rows[0] });
    } catch (error) {
        console.error('Error saving message:', error.message);
        res.status(500).json({ error: 'Error saving message' });
    }
});

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
        broadcastNotification('contact_deleted');
        res.status(200).json({ message: 'Contact deleted successfully' });
    } catch (error) {
        console.error('Error deleting contact:', error.message);
        res.status(500).json({ error: 'Error deleting contact' });
    }
});

app.get('/api/tutors/:subject', async (req, res) => {
    try {
        const subject = req.params.subject;
        console.log('Fetching tutors for subject:', subject);
        const result = await pool.query(
            `SELECT * FROM tutors WHERE EXISTS (
                SELECT 1 FROM jsonb_array_elements(subjects) AS s
                WHERE s->>'value' ILIKE $1 OR s::text ILIKE $1
            )`,
            [subject]
        );
        console.log('Tutors found:', result.rows);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error fetching tutors:', error.message, error.stack);
        res.status(500).json({ error: 'Error fetching tutors', details: error.message });
    }
});

app.post('/api/bookings', async (req, res) => {
    try {
        const { tutorId, subject, userNumber, schedule } = req.body;
        console.log('Received booking:', { tutorId, subject, userNumber, schedule });
        const result = await pool.query(
            'INSERT INTO bookings (tutor_id, subject, user_number, schedule) VALUES ($1, $2, $3, $4) RETURNING *',
            [tutorId, subject, userNumber, schedule]
        );
        console.log('Booking created:', result.rows[0]);
        broadcastNotification('booking');
        res.status(200).json({ message: 'Booking created successfully', data: result.rows[0] });
    } catch (error) {
        console.error('Error creating booking:', error.message);
        res.status(500).json({ error: 'Error creating booking' });
    }
});

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
        broadcastNotification('booking_deleted');
        res.status(200).json({ message: 'Booking deleted successfully' });
    } catch (error) {
        console.error('Error deleting booking:', error.message);
        res.status(500).json({ error: 'Error deleting booking' });
    }
});

server.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
