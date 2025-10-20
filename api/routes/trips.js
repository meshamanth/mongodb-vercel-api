// routes/trips.js
const express = require('express');
const { ObjectId } = require('mongodb');
const { getDb } = require('../db');
const authenticateToken = require('../middleware/auth');

const router = express.Router();

router.get('/api/trips/get', authenticateToken, async (req, res) => {
    try {
        const db = await getDb();
        const trips = await db.collection('trips').find({ userId: new ObjectId(req.user.userId) }).toArray();
        res.status(200).json({ trips });
    } catch (error) {
        console.error('Error fetching trips:', error);
        res.status(500).json({ error: 'Failed to fetch trips', details: error.message });
    }
});

router.post('/api/trips/create', authenticateToken, async (req, res) => {
    try {
        const db = await getDb();
        const trip = { ...req.body, userId: new ObjectId(req.user.userId), createdAt: new Date() };
        const result = await db.collection('trips').insertOne(trip);
        res.status(201).json({ trip: { id: result.insertedId.toString(), ...trip } });
    } catch (error) {
        console.error('Error creating trip:', error);
        res.status(500).json({ error: 'Failed to create trip', details: error.message });
    }
});

router.post('/api/trips/update', authenticateToken, async (req, res) => {
    try {
        const db = await getDb();
        const { tripId, ...updates } = req.body;
        const result = await db.collection('trips').updateOne(
            { _id: new ObjectId(tripId), userId: new ObjectId(req.user.userId) },
            { $set: { ...updates, updatedAt: new Date() } }
        );
        if (result.matchedCount === 0) return res.status(404).json({ error: 'Trip not found' });
        res.status(200).json({ message: 'Trip updated' });
    } catch (error) {
        console.error('Error updating trip:', error);
        res.status(500).json({ error: 'Failed to update trip', details: error.message });
    }
});

router.post('/api/trips/delete', authenticateToken, async (req, res) => {
    try {
        const db = await getDb();
        const { tripId } = req.body;
        const result = await db.collection('trips').deleteOne({
            _id: new ObjectId(tripId),
            userId: new ObjectId(req.user.userId),
        });
        if (result.deletedCount === 0) return res.status(404).json({ error: 'Trip not found' });
        res.status(200).json({ message: 'Trip deleted' });
    } catch (error) {
        console.error('Error deleting trip:', error);
        res.status(500).json({ error: 'Failed to delete trip', details: error.message });
    }
});

module.exports = router;