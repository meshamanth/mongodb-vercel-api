// routes/expenses.js
const express = require('express');
const { ObjectId } = require('mongodb');
const { getDb } = require('../db');
const authenticateToken = require('../middleware/auth');

const router = express.Router();

router.get('/api/expenses/get', authenticateToken, async (req, res) => {
    try {
        const db = await getDb();
        const { tripId } = req.query;
        const query = tripId ? { tripId, userId: new ObjectId(req.user.userId) } : { userId: new ObjectId(req.user.userId) };
        const expenses = await db.collection('expenses').find(query).toArray();
        res.status(200).json({ expenses });
    } catch (error) {
        console.error('Error fetching expenses:', error);
        res.status(500).json({ error: 'Failed to fetch expenses', details: error.message });
    }
});

router.post('/api/expenses/create', authenticateToken, async (req, res) => {
    try {
        const db = await getDb();
        const expense = { ...req.body, userId: new ObjectId(req.user.userId), createdAt: new Date() };
        const result = await db.collection('expenses').insertOne(expense);
        res.status(201).json({ expense: { id: result.insertedId.toString(), ...expense } });
    } catch (error) {
        console.error('Error creating expense:', error);
        res.status(500).json({ error: 'Failed to create expense', details: error.message });
    }
});

router.post('/api/expenses/update', authenticateToken, async (req, res) => {
    try {
        const db = await getDb();
        const { expenseId, ...updates } = req.body;
        const result = await db.collection('expenses').updateOne(
            { _id: new ObjectId(expenseId), userId: new ObjectId(req.user.userId) },
            { $set: { ...updates, updatedAt: new Date() } }
        );
        if (result.matchedCount === 0) return res.status(404).json({ error: 'Expense not found' });
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
        const result = await db.collection('expenses').deleteOne({
            _id: new ObjectId(expenseId),
            userId: new ObjectId(req.user.userId),
        });
        if (result.deletedCount === 0) return res.status(404).json({ error: 'Expense not found' });
        res.status(200).json({ message: 'Expense deleted' });
    } catch (error) {
        console.error('Error deleting expense:', error);
        res.status(500).json({ error: 'Failed to delete expense', details: error.message });
    }
});

module.exports = router;