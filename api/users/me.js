import jwt from 'jsonwebtoken'; // Assuming you're using jsonwebtoken for JWT
import { connectToDatabase } from '../../lib/mongodb'; // Adjust to your DB connection utility
// Import your User model or DB query logic

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }

    try {
        // Verify the token (replace 'your-jwt-secret' with your actual secret)
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-jwt-secret');
        const userId = decoded.userId; // Assuming your JWT payload includes userId

        // Connect to DB and fetch user
        const { db } = await connectToDatabase();
        const user = await db.collection('users').findOne({ _id: userId }, {
            projection: { password: 0 } // Exclude password
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Map MongoDB _id to id if needed
        const { _id, ...userData } = user;
        userData.id = _id.toString();

        res.status(200).json({ user: userData });
    } catch (error) {
        console.error('Error fetching current user:', error);
        res.status(401).json({ error: 'Invalid or expired token' });
    }
}