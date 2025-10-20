// api/index.js
const express = require('express');
const cors = require('cors');
const userRoutes = require('./routes/users');
const itemRoutes = require('./routes/items');
const tripRoutes = require('./routes/trips');
const expenseRoutes = require('./routes/expenses');
const { getDb, closeDb } = require('./db');
require('dotenv').config();

// Debug log to confirm module imports
console.log('Loading index.js, userRoutes:', typeof userRoutes);

const app = express();

// Validate environment variables
if (!process.env.MONGODB_URI) {
    console.error('Error: MONGODB_URI is not defined');
    process.exit(1);
}
if (!process.env.JWT_SECRET) {
    console.error('Error: JWT_SECRET is not defined');
    process.exit(1);
}

// Middleware
const allowedOrigins = [
    'http://localhost:5173',
    'https://trip-registry.netlify.app'
];

app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    next();
});
app.use(express.json());

// Debug endpoint
app.get('/debug-env', (req, res) => {
    const uri = process.env.MONGODB_URI;
    res.status(200).json({
        mongodbUriSet: !!uri,
        mongodbUriPreview: uri ? `${uri.substring(0, 20)}...` : 'undefined',
        jwtSecretSet: !!process.env.JWT_SECRET,
    });
});

// Health check endpoint
app.get('/health', async (req, res) => {
    try {
        await getDb();
        res.status(200).json({ status: 'Server is running', mongodbConnected: true });
    } catch (error) {
        console.error('Health check failed:', error.message);
        res.status(500).json({ status: 'Server running', mongodbConnected: false, error: error.message });
    }
});

// Routes
app.use('/', userRoutes);
app.use('/', itemRoutes);
app.use('/', tripRoutes);
app.use('/', expenseRoutes);

// Fallback for unmatched routes
app.use((req, res) => {
    console.error(`Route not found: ${req.method} ${req.url}`);
    res.status(404).json({ error: 'Route not found' });
});

// Handle graceful shutdown
process.on('SIGTERM', async () => {
    await closeDb();
    process.exit(0);
});

module.exports = app;