// updateExpenses.js
const { MongoClient } = require('mongodb');
require('dotenv').config();

async function updateExpenses() {
    const uri = process.env.MONGODB_URI;
    const client = new MongoClient(uri);

    try {
        await client.connect();
        console.log('Connected to MongoDB');

        const db = client.db(); // Database name is inferred from URI
        const result = await db.collection('expenses').updateMany(
            { settled: { $exists: false } },
            { $set: { settled: false } }
        );

        console.log('Update result:', result);
    } catch (error) {
        console.error('Error updating expenses:', error);
    } finally {
        await client.close();
        console.log('Disconnected from MongoDB');
    }
}

updateExpenses();