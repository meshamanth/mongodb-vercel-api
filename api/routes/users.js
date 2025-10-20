// api/routes/users.js
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { ObjectId } = require('mongodb');
const { getDb } = require('../db');
const authenticateToken = require('../middleware/auth'); // Ensure correct path

require('dotenv').config();

const router = express.Router();
const jwtSecret = process.env.JWT_SECRET || 'your_jwt_secret_key';

router.post('/signup', async (req, res) => {
    try {
        const db = await getDb();
        const { email, name, password } = req.body;
        if (!email || !name || !password) {
            return res.status(400).json({ error: 'Email, name, and password are required' });
        }
        const existingUser = await db.collection('users').findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'Email already registered' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await db.collection('users').insertOne({
            email,
            name,
            password: hashedPassword,
            createdAt: new Date(),
        });
        const user = { id: result.insertedId.toString(), email, name };
        const token = jwt.sign({ userId: result.insertedId.toString(), email }, jwtSecret, { expiresIn: '1h' });
        res.status(201).json({ message: 'User created', user, token });
    } catch (error) {
        console.error('Error during signup:', error.message, error);
        res.status(500).json({ error: 'Failed to signup', details: error.message });
    }
});

router.post('/login', async (req, res) => {
    try {
        const db = await getDb();
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }
        const user = await db.collection('users').findOne({ email });
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        const token = jwt.sign({ userId: user._id.toString(), email: user.email }, jwtSecret, { expiresIn: '1h' });
        res.status(200).json({
            message: 'Login successful',
            token,
            user: { id: user._id.toString(), email: user.email, name: user.name },
        });
    } catch (error) {
        console.error('Error during login:', error.message, error);
        res.status(500).json({ error: 'Failed to login', details: error.message });
    }
});

router.get('/api/users/me', authenticateToken, async (req, res) => {
    try {
        if (!ObjectId.isValid(req.user.userId)) {
            console.error('Invalid ObjectId in token:', req.user.userId);
            return res.status(401).json({ error: 'Invalid user ID in token' });
        }
        const db = await getDb();
        const user = await db.collection('users').findOne(
            { _id: new ObjectId(req.user.userId) },
            { projection: { password: 0 } }
        );
        if (!user) {
            console.error('User not found for ID:', req.user.userId);
            return res.status(404).json({ error: 'User not found' });
        }
        res.status(200).json({
            user: { id: user._id.toString(), email: user.email, name: user.name },
        });
    } catch (error) {
        console.error('Error fetching current user:', error.message, error);
        res.status(500).json({ error: 'Failed to fetch user', details: error.message });
    }
});

module.exports = router;