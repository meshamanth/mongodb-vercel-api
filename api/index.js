const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const uri = process.env.MONGODB_URI;
const jwtSecret = process.env.JWT_SECRET || 'your_jwt_secret_key'; // Use env var in production

app.use(cors());
app.use(express.json());

let db = null;
let client = null;

async function getDb() {
    if (db) return db;

    try {
        console.log('Connecting to MongoDB...');
        client = new MongoClient(uri);
        await client.connect();
        db = client.db('mydb');
        console.log('Connected to MongoDB');
        return db;
    } catch (error) {
        console.error('MongoDB connection failed:', error);
        throw error;
    }
}

// Health check endpoint
app.get('/health', async (req, res) => {
    try {
        await getDb();
        res.status(200).json({ status: 'Server is running', mongodbConnected: true });
    } catch (error) {
        res.status(500).json({ status: 'Server running', mongodbConnected: false, error: error.message });
    }
});

// Signup endpoint
app.post('/signup', async (req, res) => {
    try {
        const db = await getDb();
        const { email, name, password } = req.body;

        // Validate input
        if (!email || !name || !password) {
            return res.status(400).json({ error: 'Email, name, and password are required' });
        }

        // Check if email already exists
        const existingUser = await db.collection('users').findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert user
        const result = await db.collection('users').insertOne({
            email,
            name,
            password: hashedPassword,
            createdAt: new Date()
        });

        // Generate JWT
        const token = jwt.sign({ userId: result.insertedId, email }, jwtSecret, { expiresIn: '1h' });

        res.status(201).json({ message: 'User created', userId: result.insertedId, token });
    } catch (error) {
        console.error('Error during signup:', error);
        res.status(500).json({ error: 'Failed to signup', details: error.message });
    }
});

// Login endpoint
app.post('/login', async (req, res) => {
    try {
        const db = await getDb();
        const { email, password } = req.body;

        // Validate input
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Find user
        const user = await db.collection('users').findOne({ email });
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Generate JWT
        const token = jwt.sign({ userId: user._id, email: user.email }, jwtSecret, { expiresIn: '1h' });

        res.status(200).json({ message: 'Login successful', token, user: { id: user._id, email: user.email, name: user.name } });
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({ error: 'Failed to login', details: error.message });
    }
});

// Existing endpoints (items)
app.get('/api/items', async (req, res) => {
    try {
        const db = await getDb();
        const items = await db.collection('items').find().toArray();
        res.status(200).json(items);
    } catch (error) {
        console.error('Error fetching items:', error);
        res.status(500).json({ error: 'Failed to fetch items', details: error.message });
    }
});

app.get('/api/items/:id', async (req, res) => {
    try {
        const db = await getDb();
        const item = await db.collection('items').findOne({ _id: new ObjectId(req.params.id) });
        if (!item) return res.status(404).json({ error: 'Item not found' });
        res.status(200).json(item);
    } catch (error) {
        console.error('Error fetching item:', error);
        res.status(500).json({ error: 'Failed to fetch item', details: error.message });
    }
});

app.post('/api/items', async (req, res) => {
    try {
        const db = await getDb();
        const { name, description } = req.body;
        if (!name) return res.status(400).json({ error: 'Name is required' });
        const result = await db.collection('items').insertOne({ name, description, createdAt: new Date() });
        res.status(201).json({ _id: result.insertedId, name, description });
    } catch (error) {
        console.error('Error creating item:', error);
        res.status(500).json({ error: 'Failed to create item', details: error.message });
    }
});

app.put('/api/items/:id', async (req, res) => {
    try {
        const db = await getDb();
        const { name, description } = req.body;
        const result = await db.collection('items').updateOne(
            { _id: new ObjectId(req.params.id) },
            { $set: { name, description, updatedAt: new Date() } }
        );
        if (result.matchedCount === 0) return res.status(404).json({ error: 'Item not found' });
        res.status(200).json({ message: 'Item updated' });
    } catch (error) {
        console.error('Error updating item:', error);
        res.status(500).json({ error: 'Failed to update item', details: error.message });
    }
});

app.delete('/api/items/:id', async (req, res) => {
    try {
        const db = await getDb();
        const result = await db.collection('items').deleteOne({ _id: new ObjectId(req.params.id) });
        if (result.deletedCount === 0) return res.status(404).json({ error: 'Item not found' });
        res.status(200).json({ message: 'Item deleted' });
    } catch (error) {
        console.error('Error deleting item:', error);
        res.status(500).json({ error: 'Failed to delete item', details: error.message });
    }
});

process.on('SIGTERM', async () => {
    if (client) {
        await client.close();
        console.log('MongoDB client closed');
    }
    process.exit(0);
});

module.exports = app;