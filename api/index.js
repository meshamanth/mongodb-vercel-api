const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;
const uri = process.env.MONGODB_URI;

app.use(cors());
app.use(express.json());

let db;
async function connectToMongo() {
    try {
        const client = new MongoClient(uri);
        await client.connect();
        db = client.db('mydb');
        console.log('Connected to MongoDB');
    } catch (error) {
        console.error('MongoDB connection failed:', error);
        throw error; // Let Vercel log the error
    }
}

connectToMongo().catch(err => {
    console.error('MongoDB connection failed:', err);
    process.exit(1); // Exit only for local development
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'Server is running', mongodbConnected: !!db });
});

// GET all items
app.get('/api/items', async (req, res) => {
    try {
        if (!db) throw new Error('MongoDB not connected');
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
        if (!db) throw new Error('MongoDB not connected');
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
        if (!db) throw new Error('MongoDB not connected');
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
        if (!db) throw new Error('MongoDB not connected');
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
        if (!db) throw new Error('MongoDB not connected');
        const result = await db.collection('items').deleteOne({ _id: new ObjectId(req.params.id) });
        if (result.deletedCount === 0) return res.status(404).json({ error: 'Item not found' });
        res.status(200).json({ message: 'Item deleted' });
    } catch (error) {
        console.error('Error deleting item:', error);
        res.status(500).json({ error: 'Failed to delete item', details: error.message });
    }
});

// Start server for local development
if (require.main === module) {
    app.listen(port, () => {
        console.log(`Server running on port ${port}`);
    }).on('error', (err) => {
        console.error('Server startup error:', err);
    });
}

// Export for Vercel
module.exports = app;