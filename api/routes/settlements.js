// api/routes/settlements.js
const express = require('express');
const nodemailer = require('nodemailer');
const { ObjectId } = require('mongodb');
const { getDb } = require('../db');
const authenticateToken = require('../middleware/auth');
const router = express.Router();

// Configure Nodemailer transport
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

// Middleware to validate environment variables
const validateEnv = (req, res, next) => {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.error('Error: EMAIL_USER or EMAIL_PASS is not defined');
        return res.status(500).json({ error: 'Email service configuration missing' });
    }
    next();
};

// Send settlement email and record settlement
router.post('/send-settlement-email', authenticateToken, validateEnv, async (req, res) => {
    try {
        const {
            fromUserId,
            toUserId,
            fromEmail,
            toEmail,
            fromName,
            toName,
            amount,
            currentUserName,
        } = req.body;

        // Validate required fields
        if (!fromUserId || !toUserId || !fromEmail || !toEmail || !amount || !fromName || !toName) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Validate ObjectIds
        if (!ObjectId.isValid(fromUserId) || !ObjectId.isValid(toUserId)) {
            return res.status(400).json({ error: 'Invalid user ID format' });
        }

        // Verify users exist in MongoDB
        const db = await getDb();
        const users = db.collection('users');
        const fromUser = await users.findOne({ _id: new ObjectId(fromUserId) });
        const toUser = await users.findOne({ _id: new ObjectId(toUserId) });

        if (!fromUser || !toUser) {
            return res.status(404).json({ error: 'One or both users not found' });
        }

        // Verify the authenticated user is involved
        if (req.user.userId !== fromUserId && req.user.userId !== toUserId) {
            return res.status(403).json({ error: 'Unauthorized: You must be involved in the settlement' });
        }

        // Email content
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: fromEmail,
            bcc: toEmail,
            subject: `Payment Request: Settle ₹${amount} with ${toName}`,
            html: `
                <h2>Payment Request</h2>
                <p>Hello ${fromName},</p>
                <p>You need to settle ₹${amount.toFixed(2)} with ${toName}.</p>
                <p>This request was initiated by ${currentUserName}.</p>
                <p>Please make the payment at your earliest convenience.</p>
                <p>Thank you!</p>
                <p>Trip Registry Team</p>
            `,
        };

        // Send email
        await transporter.sendMail(mailOptions);

        // Store settlement record in MongoDB
        const settlements = db.collection('settlements');
        await settlements.insertOne({
            fromUserId: new ObjectId(fromUserId),
            toUserId: new ObjectId(toUserId),
            amount,
            status: 'settled',
            createdAt: new Date(),
            initiatedBy: req.user.userId,
        });

        res.status(200).json({ message: 'Email sent and settlement recorded successfully' });
    } catch (error) {
        console.error('Error sending settlement email:', error.message, error);
        res.status(500).json({ error: 'Failed to send email', details: error.message });
    }
});

module.exports = router;