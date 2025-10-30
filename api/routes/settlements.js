// api/routes/settlements.js
const express = require('express');
const { ObjectId } = require('mongodb');
const nodemailer = require('nodemailer');
const { getDb } = require('../db');
const authenticateToken = require('../middleware/auth');

const router = express.Router();

// Configure Nodemailer transporter
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_PORT === '465',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

// POST /api/settlements/remind
router.post('/settlements/remind', authenticateToken, async (req, res) => {
    try {
        const db = await getDb();
        const { fromUserId, toUserId, amount, tripId } = req.body;

        if (!fromUserId || !toUserId || !amount || !tripId) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const trip = await db.collection('trips').findOne({
            _id: new ObjectId(tripId),
            $or: [
                { userId: new ObjectId(req.user.userId) },
                { participants: req.user.userId },
            ],
        });

        if (!trip) {
            return res.status(403).json({ error: 'Unauthorized to send reminder for this trip' });
        }

        const usersCollection = db.collection('users');
        const fromUser = await usersCollection.findOne({ _id: new ObjectId(fromUserId) });
        const toUser = await usersCollection.findOne({ _id: new ObjectId(toUserId) });

        if (!fromUser || !toUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: fromUser.email,
            subject: `Payment Reminder for ${trip.name}`,
            html: `
                <h3>Payment Reminder</h3>
                <p>Dear ${fromUser.name},</p>
                <p>You owe ₹${amount.toFixed(2)} to ${toUser.name} for the trip "${trip.name}".</p>
                <p>Please settle the payment at your earliest convenience.</p>
                <p><a href="${process.env.FRONTEND_URL}/trips/${tripId}">View Trip Details</a></p>
                <p>Thank you!</p>
            `,
        };

        await transporter.sendMail(mailOptions);

        const settlementsCollection = db.collection('settlements');
        const existingSettlement = await settlementsCollection.findOne({
            fromUserId,
            toUserId,
            amount,
            tripId,
            status: 'pending',
        });

        if (existingSettlement) {
            await settlementsCollection.updateOne(
                { _id: existingSettlement._id },
                { $set: { remindedAt: new Date() } }
            );
        } else {
            await settlementsCollection.insertOne({
                fromUserId,
                toUserId,
                amount,
                tripId,
                status: 'pending',
                createdAt: new Date(),
                remindedAt: new Date(),
            });
        }

        res.status(200).json({ message: 'Reminder sent successfully' });
    } catch (error) {
        console.error('Error sending reminder:', error);
        res.status(500).json({ error: 'Failed to send reminder', details: error.message });
    }
});

// POST /api/settlements/settle
router.post('/settlements/settle', authenticateToken, async (req, res) => {
    try {
        const db = await getDb();
        const { fromUserId, toUserId, amount, tripId } = req.body;

        if (!fromUserId || !toUserId || !amount || !tripId) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const trip = await db.collection('trips').findOne({
            _id: new ObjectId(tripId),
            $or: [
                { userId: new ObjectId(req.user.userId) },
                { participants: req.user.userId },
            ],
        });

        if (!trip) {
            return res.status(403).json({ error: 'Unauthorized to settle payment for this trip' });
        }

        const settlementsCollection = db.collection('settlements');
        const existingSettlement = await settlementsCollection.findOne({
            fromUserId,
            toUserId,
            amount,
            tripId,
            status: 'pending',
        });

        if (existingSettlement) {
            await settlementsCollection.updateOne(
                { _id: existingSettlement._id },
                { $set: { status: 'settled', settledAt: new Date() } }
            );
        } else {
            await settlementsCollection.insertOne({
                fromUserId,
                toUserId,
                amount,
                tripId,
                status: 'settled',
                createdAt: new Date(),
                settledAt: new Date(),
            });
        }

        res.status(200).json({ message: 'Payment settled successfully' });
    } catch (error) {
        console.error('Error settling payment:', error);
        res.status(500).json({ error: 'Failed to settle payment', details: error.message });
    }
});

// GET /api/settlements
router.get('/settlements', authenticateToken, async (req, res) => {
    try {
        const db = await getDb();
        const { tripId } = req.query;

        if (!tripId) {
            return res.status(400).json({ error: 'tripId is required' });
        }

        const trip = await db.collection('trips').findOne({
            _id: new ObjectId(tripId),
            $or: [
                { userId: new ObjectId(req.user.userId) },
                { participants: req.user.userId },
            ],
        });

        if (!trip) {
            return res.status(403).json({ error: 'Unauthorized to access settlements for this trip' });
        }

        const settlements = await db.collection('settlements').find({ tripId }).toArray();
        res.status(200).json({
            settlements: settlements.map(settlement => ({
                id: settlement._id.toString(),
                fromUserId: settlement.fromUserId,
                toUserId: settlement.toUserId,
                amount: settlement.amount,
                tripId: settlement.tripId,
                status: settlement.status,
                createdAt: settlement.createdAt,
                remindedAt: settlement.remindedAt,
                settledAt: settlement.settledAt,
            })),
        });
    } catch (error) {
        console.error('Error fetching settlements:', error);
        res.status(500).json({ error: 'Failed to fetch settlements', details: error.message });
    }
});

module.exports = router;