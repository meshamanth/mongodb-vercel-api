const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');
require('dotenv').config();

const app = express();
const uri = process.env.MONGODB_URI;

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
        await getDb(); // Ensure connected
        res.status(200).json({ status: 'Server is running', mongodbConnected: true });
    } catch (error) {
        res.status(500).json({ status: 'Server running', mongodbConnected: false, error: error.message });
    }
});

// GET all items
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

// GET single item by ID
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

// POST new item
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

// PUT update item
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

// DELETE item
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

// Graceful close on Vercel (optional)
process.on('SIGTERM', async () => {
    if (client) {
        await client.close();
        console.log('MongoDB client closed');
    }
    process.exit(0);
});

// Export for Vercel (no local server needed)
module.exports = app;