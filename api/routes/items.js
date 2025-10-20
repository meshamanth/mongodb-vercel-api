// routes/items.js
const express = require('express');
const { ObjectId } = require('mongodb');
const { getDb } = require('../db');

const router = express.Router();

router.get('/api/items', async (req, res) => {
    try {
        const db = await getDb();
        const items = await db.collection('items').find().toArray();
        res.status(200).json(items);
    } catch (error) {
        console.error('Error fetching items:', error);
        res.status(500).json({ error: 'Failed to fetch items', details: error.message });
    }
});

router.get('/api/items/:id', async (req, res) => {
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

router.post('/api/items', async (req, res) => {
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

router.put('/api/items/:id', async (req, res) => {
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

router.delete('/api/items/:id', async (req, res) => {
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

module.exports = router;