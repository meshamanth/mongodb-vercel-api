// api/index.js
const express = require('express');
const cors = require('cors');
const userRoutes = require('./routes/users');
const itemRoutes = require('./routes/items');
const tripRoutes = require('./routes/trips');
const expenseRoutes = require('./routes/expenses'); // ← already correct
const { getDb, closeDb } = require('./db');

async function ensureIndexes() {
    try {
        const db = await getDb();
        await db.collection('expenses').createIndex({ tripId: 1 }, { background: true });
        console.log('Ensured index on expenses.tripId');
    } catch (err) {
        if (!err.message.includes('duplicate')) {
            console.error('Index creation failed:', err);
        }
    }
}
ensureIndexes();
require('dotenv').config();

const app = express();

// CORS
const allowedOrigins = [
    'http://localhost:5173',
    'https://trip-registry.netlify.app',
    'https://trip.shamanth.in',
];

app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    if (req.method === 'OPTIONS') return res.status(200).end();
    next();
});

app.use(express.json());

// Routes
app.use('/', userRoutes);
app.use('/', itemRoutes);
app.use('/', tripRoutes);
app.use('/', expenseRoutes); // ← this mounts /api/expenses

// Health
app.get('/health', async (req, res) => {
    try {
        await getDb();
        res.json({ status: 'ok', mongodb: true });
    } catch {
        res.status(500).json({ status: 'error', mongodb: false });
    }
});

process.on('SIGTERM', async () => {
    await closeDb();
    process.exit(0);
});

module.exports = app;