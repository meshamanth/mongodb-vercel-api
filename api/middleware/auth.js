// api/middleware/auth.js
const jwt = require('jsonwebtoken');
require('dotenv').config();

const jwtSecret = process.env.JWT_SECRET || 'your_jwt_secret_key';

// Debug log to confirm module loading
console.log('Loading auth.js, jwtSecret:', !!jwtSecret);

function authenticateToken(req, res, next) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
        console.error('No token provided in Authorization header');
        return res.status(401).json({ error: 'No token provided' });
    }

    try {
        const decoded = jwt.verify(token, jwtSecret);
        if (!decoded.userId) {
            console.error('Token missing userId:', decoded);
            return res.status(401).json({ error: 'Invalid token payload' });
        }
        req.user = decoded;
        next();
    } catch (error) {
        console.error('Token verification failed:', error.message, error);
        res.status(401).json({ error: 'Invalid or expired token' });
    }
}

module.exports = authenticateToken;