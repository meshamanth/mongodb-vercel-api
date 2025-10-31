// api/routes/expenses.js
const express = require('express');
const { ObjectId } = require('mongodb');
const { getDb } = require('../db');
const authenticateToken = require('../middleware/auth');

const router = express.Router();

/* -------------------------------------------------------------
   GET /api/expenses?tripId=xxx
   → returns all expenses for a trip (or all user trips if no tripId)
   ------------------------------------------------------------- */
router.get('/api/expenses', authenticateToken, async (req, res) => {
    try {
        const db = await getDb();
        const { tripId } = req.query;

        if (tripId) {
            // ---- Single trip ----
            const trip = await db.collection('trips').findOne({
                _id: new ObjectId(tripId),
                $or: [
                    { userId: new ObjectId(req.user.userId) },
                    { participants: req.user.userId },
                ],
            });

            if (!trip) {
                return res.status(403).json({ error: 'Unauthorized' });
            }

            const expenses = await db
                .collection('expenses')
                .find({ tripId: tripId.toString() })
                .toArray();

            return res.status(200).json({
                expenses: expenses.map(mapExpense),
            });
        }

        // ---- All user trips ----
        const trips = await db.collection('trips').find({
            $or: [
                { userId: new ObjectId(req.user.userId) },
                { participants: req.user.userId },
            ],
        }).toArray();

        const tripIds = trips.map(t => t._id.toString());
        const expenses = await db
            .collection('expenses')
            .find({ tripId: { $in: tripIds } })
            .toArray();

        res.status(200).json({
            expenses: expenses.map(mapExpense),
        });
    } catch (err) {
        console.error('GET /api/expenses error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

/* -------------------------------------------------------------
   POST /api/expenses
   → create expense (including settlement expenses)
   ------------------------------------------------------------- */
router.post('/api/expenses', authenticateToken, async (req, res) => {
    try {
        const db = await getDb();
        const {
            tripId,
            description,
            amount,
            paidBy,
            participants = [],
            splitType = 'equal', // 'equal' | 'unequal'
            shares = {}, // only for unequal: { userId: amountOwed }
        } = req.body;

        if (!tripId || !description || amount == null || !paidBy) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Authorization
        const trip = await db.collection('trips').findOne({
            _id: new ObjectId(tripId),
            $or: [
                { userId: new ObjectId(req.user.userId) },
                { participants: req.user.userId },
            ],
        });
        if (!trip) return res.status(403).json({ error: 'Unauthorized' });

        // Validate unequal split
        if (splitType === 'unequal' && Object.keys(shares).length === 0) {
            return res.status(400).json({ error: 'shares required for unequal split' });
        }

        const expense = {
            tripId,
            description,
            amount: Number(amount),
            paidBy,
            participants,
            splitType,
            shares: splitType === 'unequal' ? shares : {},
            userId: new ObjectId(req.user.userId),
            createdAt: new Date(),
        };

        const result = await db.collection('expenses').insertOne(expense);

        res.status(201).json({
            expense: {
                id: result.insertedId.toString(),
                ...expense,
            },
        });
    } catch (err) {
        console.error('POST /api/expenses error:', err);
        res.status(500).json({ error: 'Failed to create expense' });
    }
});

/* -------------------------------------------------------------
   PATCH /api/expenses/:id
   → update expense
   ------------------------------------------------------------- */
router.patch('/api/expenses/:id', authenticateToken, async (req, res) => {
    try {
        const db = await getDb();
        const { id } = req.params;
        const updates = req.body;

        const expense = await db.collection('expenses').findOne({ _id: new ObjectId(id) });
        if (!expense) return res.status(404).json({ error: 'Expense not found' });

        // Authorization
        const trip = await db.collection('trips').findOne({
            _id: new ObjectId(expense.tripId),
            $or: [
                { userId: new ObjectId(req.user.userId) },
                { participants: req.user.userId },
            ],
        });
        if (!trip) return res.status(403).json({ error: 'Unauthorized' });

        await db.collection('expenses').updateOne(
            { _id: new ObjectId(id) },
            { $set: { ...updates, updatedAt: new Date() } }
        );

        res.status(200).json({ message: 'Expense updated' });
    } catch (err) {
        console.error('PATCH /api/expenses error:', err);
        res.status(500).json({ error: 'Failed to update' });
    }
});

/* -------------------------------------------------------------
   DELETE /api/expenses/:id
   ------------------------------------------------------------- */
router.delete('/api/expenses/:id', authenticateToken, async (req, res) => {
    try {
        const db = await getDb();
        const { id } = req.params;

        const expense = await db.collection('expenses').findOne({ _id: new ObjectId(id) });
        if (!expense) return res.status(404).json({ error: 'Expense not found' });

        // Authorization
        const trip = await db.collection('trips').findOne({
            _id: new ObjectId(expense.tripId),
            $or: [
                { userId: new ObjectId(req.user.userId) },
                { participants: req.user.userId },
            ],
        });
        if (!trip) return res.status(403).json({ error: 'Unauthorized' });

        await db.collection('expenses').deleteOne({ _id: new ObjectId(id) });
        res.status(200).json({ message: 'Expense deleted' });
    } catch (err) {
        console.error('DELETE /api/expenses error:', err);
        res.status(500).json({ error: 'Failed to delete' });
    }
});

/* -------------------------------------------------------------
   Helper: map DB → API
   ------------------------------------------------------------- */
function mapExpense(expense) {
    return {
        id: expense._id.toString(),
        tripId: expense.tripId,
        description: expense.description,
        amount: expense.amount,
        paidBy: expense.paidBy,
        participants: expense.participants || [],
        splitType: expense.splitType || 'equal',
        shares: expense.shares || {},
        createdAt: expense.createdAt,
    };
}

module.exports = router;