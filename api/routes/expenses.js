const express = require('express');
const { ObjectId } = require('mongodb');
const { getDb } = require('../db');
const authenticateToken = require('../middleware/auth');
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_PORT === '465',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

const router = express.Router();

router.get('/api/expenses/get', authenticateToken, async (req, res) => {
    try {
        const db = await getDb();
        const { tripId } = req.query;
        if (tripId) {
            // Check if user is participant or creator of the trip
            const trip = await db.collection('trips').findOne({
                _id: new ObjectId(tripId),
                $or: [
                    { userId: new ObjectId(req.user.userId) },
                    { participants: req.user.userId }
                ]
            });
            if (!trip) {
                console.log('User unauthorized for trip:', tripId, 'user:', req.user.userId); // Debug
                return res.status(403).json({ error: 'Unauthorized to access expenses for this trip' });
            }
            const expenses = await db.collection('expenses').find({ tripId }).toArray();
            console.log('Fetching expenses for trip:', tripId, 'Found:', expenses.length); // Debug
            res.status(200).json({
                expenses: expenses.map(expense => ({
                    id: expense._id.toString(),
                    tripId: expense.tripId,
                    description: expense.description,
                    amount: expense.amount,
                    paidBy: expense.paidBy,
                    participants: expense.participants || [],
                    createdAt: expense.createdAt
                }))
            });
        } else {
            // Get all trips the user is involved in
            const trips = await db.collection('trips').find({
                $or: [
                    { userId: new ObjectId(req.user.userId) },
                    { participants: req.user.userId }
                ]
            }).toArray();
            const tripIds = trips.map(trip => trip._id.toString());
            const expenses = await db.collection('expenses').find({ tripId: { $in: tripIds } }).toArray();
            console.log('Fetching all expenses for user:', req.user.userId, 'Found:', expenses.length); // Debug
            res.status(200).json({
                expenses: expenses.map(expense => ({
                    id: expense._id.toString(),
                    tripId: expense.tripId,
                    description: expense.description,
                    amount: expense.amount,
                    paidBy: expense.paidBy,
                    participants: expense.participants || [],
                    createdAt: expense.createdAt
                }))
            });
        }
    } catch (error) {
        console.error('Error fetching expenses:', error);
        res.status(500).json({ error: 'Failed to fetch expenses', details: error.message });
    }
});

router.post('/api/expenses/create', authenticateToken, async (req, res) => {
    try {
        const db = await getDb();
        const { tripId, description, amount, paidBy, participants } = req.body;
        if (!tripId) {
            return res.status(400).json({ error: 'tripId is required' });
        }
        // Check if user is participant or creator
        const trip = await db.collection('trips').findOne({
            _id: new ObjectId(tripId),
            $or: [
                { userId: new ObjectId(req.user.userId) },
                { participants: req.user.userId }
            ]
        });
        if (!trip) {
            console.log('User unauthorized to add expense for trip:', tripId, 'user:', req.user.userId); // Debug
            return res.status(403).json({ error: 'Unauthorized to add expense to this trip' });
        }
        const expense = {
            tripId,
            description,
            amount: Number(amount),
            paidBy,
            participants: participants || [],
            userId: new ObjectId(req.user.userId), // Store creator for reference
            createdAt: new Date()
        };
        console.log('Creating expense:', expense); // Debug
        const result = await db.collection('expenses').insertOne(expense);
        res.status(201).json({
            expense: {
                id: result.insertedId.toString(),
                ...expense
            }
        });
    } catch (error) {
        console.error('Error creating expense:', error);
        res.status(500).json({ error: 'Failed to create expense', details: error.message });
    }
});

router.post('/api/expenses/update', authenticateToken, async (req, res) => {
    try {
        const db = await getDb();
        const { expenseId, ...updates } = req.body;
        const expense = await db.collection('expenses').findOne({ _id: new ObjectId(expenseId) });
        if (!expense) {
            console.log('Expense not found:', expenseId); // Debug
            return res.status(404).json({ error: 'Expense not found' });
        }
        // Check if user is participant or creator of the trip
        const trip = await db.collection('trips').findOne({
            _id: new ObjectId(expense.tripId),
            $or: [
                { userId: new ObjectId(req.user.userId) },
                { participants: req.user.userId }
            ]
        });
        if (!trip) {
            console.log('User unauthorized to update expense for trip:', expense.tripId, 'user:', req.user.userId); // Debug
            return res.status(403).json({ error: 'Unauthorized to update this expense' });
        }
        const result = await db.collection('expenses').updateOne(
            { _id: new ObjectId(expenseId) },
            { $set: { ...updates, updatedAt: new Date() } }
        );
        res.status(200).json({ message: 'Expense updated' });
    } catch (error) {
        console.error('Error updating expense:', error);
        res.status(500).json({ error: 'Failed to update expense', details: error.message });
    }
});

router.post('/api/expenses/delete', authenticateToken, async (req, res) => {
    try {
        const db = await getDb();
        const { expenseId } = req.body;
        const expense = await db.collection('expenses').findOne({ _id: new ObjectId(expenseId) });
        if (!expense) {
            console.log('Expense not found:', expenseId); // Debug
            return res.status(404).json({ error: 'Expense not found' });
        }
        // Check if user is participant or creator of the trip
        const trip = await db.collection('trips').findOne({
            _id: new ObjectId(expense.tripId),
            $or: [
                { userId: new ObjectId(req.user.userId) },
                { participants: req.user.userId }
            ]
        });
        if (!trip) {
            console.log('User unauthorized to delete expense for trip:', expense.tripId, 'user:', req.user.userId); // Debug
            return res.status(403).json({ error: 'Unauthorized to delete this expense' });
        }
        const result = await db.collection('expenses').deleteOne({
            _id: new ObjectId(expenseId),
        });
        res.status(200).json({ message: 'Expense deleted' });
    } catch (error) {
        console.error('Error deleting expense:', error);
        res.status(500).json({ error: 'Failed to delete expense', details: error.message });
    }
});

router.post('/expenses/remind', authenticateToken, async (req, res) => {
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

        res.status(200).json({ message: 'Reminder sent successfully' });
    } catch (error) {
        console.error('Error sending reminder:', error);
        res.status(500).json({ error: 'Failed to send reminder', details: error.message });
    }
});

router.post('/expenses/settle', authenticateToken, async (req, res) => {
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

        await db.collection('expenses').updateMany(
            {
                tripId,
                paidBy: toUserId,
                'participants.userId': fromUserId,
                settled: { $ne: true },
            },
            { $set: { settled: true, settledAt: new Date() } }
        );

        res.status(200).json({ message: 'Payment settled successfully' });
    } catch (error) {
        console.error('Error settling payment:', error);
        res.status(500).json({ error: 'Failed to settle payment', details: error.message });
    }
});

module.exports = router;