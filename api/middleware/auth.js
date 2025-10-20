// middleware/auth.js
const jwt = require('jsonwebtoken');
require('dotenv').config();

const jwtSecret = process.env.JWT_SECRET || 'your_jwt_secret_key';

function authenticateToken(req, res, next) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }

    try {
        const decoded = jwt.verify(token, jwtSecret);
        req.user = decoded; // Attach userId and email to req.user
        next();
    } catch (error) {
        console.error('Token verification failed:', error);
        res.status(401).json({ error: 'Invalid or expired token' });
    }
}

module.exports = authenticateToken;