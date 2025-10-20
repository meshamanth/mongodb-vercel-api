// index.js
const express = require('express');
const cors = require('cors');
const userRoutes = require('./routes/users');
const itemRoutes = require('./routes/items');
const tripRoutes = require('./routes/trips');
const expenseRoutes = require('./routes/expenses');
const { getDb, closeDb } = require('./db');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors({ origin: ['http://localhost:5173', 'https://mongodb-vercel-frontend.vercel.app'] }));
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
        res.status(500).json({ status: 'Server running', mongodbConnected: false, error: error.message });
    }
});

// Routes
app.use('/', userRoutes);
app.use('/', itemRoutes);
app.use('/', tripRoutes);
app.use('/', expenseRoutes);

// Handle graceful shutdown
process.on('SIGTERM', async () => {
    await closeDb();
    process.exit(0);
});

module.exports = app;