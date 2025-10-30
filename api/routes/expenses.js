// api/routes/expenses.js
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