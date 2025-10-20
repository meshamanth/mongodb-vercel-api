const express = require('express');
const { ObjectId } = require('mongodb');
const { getDb } = require('../db');
const authenticateToken = require('../middleware/auth');

const router = express.Router();

router.get('/api/trips/get', authenticateToken, async (req, res) => {
    try {
        const db = await getDb();
        const trips = await db.collection('trips').find({
            $or: [
                { userId: new ObjectId(req.user.userId) }, // Trips created by user
                { participants: req.user.userId } // Trips where user is a participant
            ]
        }).toArray();
        console.log('Fetching trips for user:', req.user.userId, 'Found:', trips.length); // Debug
        res.status(200).json({
            trips: trips.map(trip => ({
                id: trip._id.toString(),
                name: trip.name,
                description: trip.description || '',
                createdBy: trip.userId.toString(),
                participants: trip.participants || [], // Ensure participants is always an array
                createdAt: trip.createdAt
            }))
        });
    } catch (error) {
        console.error('Error fetching trips:', error);
        res.status(500).json({ error: 'Failed to fetch trips', details: error.message });
    }
});

router.post('/api/trips/create', authenticateToken, async (req, res) => {
    try {
        const db = await getDb();
        const { name, description, participants } = req.body;
        const trip = {
            name,
            description: description || '',
            userId: new ObjectId(req.user.userId),
            createdBy: req.user.userId, // Store as string for consistency
            participants: [req.user.userId, ...(participants || [])], // Include creator in participants
            createdAt: new Date()
        };
        console.log('Creating trip:', trip); // Debug
        const result = await db.collection('trips').insertOne(trip);
        res.status(201).json({
            trip: {
                id: result.insertedId.toString(),
                ...trip
            }
        });
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
            {
                _id: new ObjectId(tripId),
                userId: new ObjectId(req.user.userId)
            },
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