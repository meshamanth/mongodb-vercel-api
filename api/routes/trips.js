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
                { userId: new ObjectId(req.user.userId) },
                { participants: req.user.userId }
            ]
        }).toArray();
        console.log('Fetched trips for user:', req.user.userId, 'Found:', trips.length);
        res.status(200).json({
            trips: trips.map(trip => ({
                id: trip._id.toString(),
                name: trip.name,
                description: trip.description,
                participants: [...new Set(trip.participants)], // Ensure unique participants
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
        if (!name) {
            return res.status(400).json({ error: 'Name is required' });
        }
        const uniqueParticipants = [...new Set(participants || [])]; // Remove duplicates
        const trip = {
            name,
            description,
            participants: uniqueParticipants,
            userId: new ObjectId(req.user.userId),
            createdAt: new Date()
        };
        console.log('Creating trip:', trip);
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
        const trip = await db.collection('trips').findOne({ _id: new ObjectId(tripId) });
        if (!trip) {
            console.log('Trip not found:', tripId);
            return res.status(404).json({ error: 'Trip not found' });
        }
        if (trip.userId.toString() !== req.user.userId) {
            console.log('User unauthorized to update trip:', tripId, 'user:', req.user.userId);
            return res.status(403).json({ error: 'Unauthorized to update this trip' });
        }
        if (updates.participants) {
            updates.participants = [...new Set(updates.participants)]; // Remove duplicates
        }
        const result = await db.collection('trips').updateOne(
            { _id: new ObjectId(tripId) },
            { $set: { ...updates, updatedAt: new Date() } }
        );
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
        const trip = await db.collection('trips').findOne({ _id: new ObjectId(tripId) });
        if (!trip) {
            console.log('Trip not found:', tripId);
            return res.status(404).json({ error: 'Trip not found' });
        }
        if (trip.userId.toString() !== req.user.userId) {
            console.log('User unauthorized to delete trip:', tripId, 'user:', req.user.userId);
            return res.status(403).json({ error: 'Unauthorized to delete this trip' });
        }
        await db.collection('trips').deleteOne({ _id: new ObjectId(tripId) });
        await db.collection('expenses').deleteMany({ tripId });
        res.status(200).json({ message: 'Trip deleted' });
    } catch (error) {
        console.error('Error deleting trip:', error);
        res.status(500).json({ error: 'Failed to delete trip', details: error.message });
    }
});

module.exports = router;