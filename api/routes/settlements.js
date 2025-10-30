// api/routes/settlements.js
const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

// Middleware to verify JWT token
const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token provided' });

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = decoded.userId;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
    }
};

// Configure Nodemailer transporter
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_PORT === '465', // true for port 465, false for other ports
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

// POST /api/settlements/remind
router.post('/settlements/remind', authenticate, async (req, res) => {
    try {
        const { fromUserId, toUserId, amount, tripId } = req.body;

        if (!fromUserId || !toUserId || !amount || !tripId) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const db = await getDb();
        const usersCollection = db.collection('users');
        const tripsCollection = db.collection('trips');

        // Fetch user details
        const fromUser = await usersCollection.findOne({ _id: fromUserId });
        const toUser = await usersCollection.findOne({ _id: toUserId });
        const trip = await tripsCollection.findOne({ _id: tripId });

        if (!fromUser || !toUser || !trip) {
            return res.status(404).json({ error: 'User or trip not found' });
        }

        // Send reminder email
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

        // Optionally, log the reminder in a new settlements collection
        const settlementsCollection = db.collection('settlements');
        await settlementsCollection.insertOne({
            fromUserId,
            toUserId,
            amount,
            tripId,
            status: 'pending',
            createdAt: new Date(),
            remindedAt: new Date(),
        });

        res.status(200).json({ message: 'Reminder sent successfully' });
    } catch (error) {
        console.error('Error sending reminder:', error);
        res.status(500).json({ error: 'Failed to send reminder' });
    }
});

// POST /api/settlements/settle
router.post('/settlements/settle', authenticate, async (req, res) => {
    try {
        const { fromUserId, toUserId, amount, tripId } = req.body;

        if (!fromUserId || !toUserId || !amount || !tripId) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const db = await getDb();
        const settlementsCollection = db.collection('settlements');
        const expensesCollection = db.collection('expenses');

        // Find and update the settlement record
        const settlement = await settlementsCollection.findOneAndUpdate(
            { fromUserId, toUserId, amount, tripId, status: 'pending' },
            { $set: { status: 'settled', settledAt: new Date() } },
            { returnDocument: 'after' }
        );

        if (!settlement.value) {
            // If no settlement exists, create one and mark as settled
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

        // Optionally, update related expenses to mark them as settled
        await expensesCollection.updateMany(
            { tripId, paidBy: toUserId, 'participants.userId': fromUserId, settled: false },
            { $set: { settled: true, settledAt: new Date() } }
        );

        res.status(200).json({ message: 'Payment settled successfully' });
    } catch (error) {
        console.error('Error settling payment:', error);
        res.status(500).json({ error: 'Failed to settle payment' });
    }
});

module.exports = router;