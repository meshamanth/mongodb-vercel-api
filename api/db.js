// api/db.js
const { MongoClient } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGODB_URI;
let db = null;
let client = null;

async function getDb() {
    if (db) return db;
    try {
        console.log('Connecting to MongoDB with URI:', uri ? `${uri.substring(0, 20)}...` : 'undefined');
        if (!uri) throw new Error('MONGODB_URI is not defined');
        client = new MongoClient(uri);
        await client.connect();
        db = client.db('mydb');
        console.log('Connected to MongoDB');
        return db;
    } catch (error) {
        console.error('MongoDB connection failed:', error);
        throw error;
    }
}

async function closeDb() {
    if (client) {
        await client.close();
        console.log('MongoDB client closed');
        db = null;
        client = null;
    }
}

module.exports = { getDb, closeDb };