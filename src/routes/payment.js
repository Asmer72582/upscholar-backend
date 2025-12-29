const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const mongoose = require('mongoose');
const { auth } = require('../middleware/auth');
const { razorpayInstance, UPCOIN_PACKAGES } = require('../config/razorpay');
const Payment = require('../models/Payment');
const User = require('../models/User');
const Transaction = require('../models/Transaction');

/**
 * @route   GET /api/payment/packages
 * @desc    Get all available UpCoin packages
 * @access  Public
 */
router.get('/packages', (req, res) => {
    try {
        res.json({
            success: true,
            packages: UPCOIN_PACKAGES
        });
    } catch (err) {
        console.error('Error fetching packages:', err.message);
        res.status(500).json({ message: 'Server error' });
    }
});

/**
 * @route   POST /api/payment/create-order
 * @desc    Create Razorpay order for UpCoin purchase
 * @access  Private
 */
router.post('/create-order', auth, async(req, res) => {
    try {
        const { packageId } = req.body;

        if (!packageId) {
            return res.status(400).json({ message: 'Package ID is required' });
        }

        // Find the package
        const selectedPackage = UPCOIN_PACKAGES.find(pkg => pkg.id === packageId);
        if (!selectedPackage) {
            return res.status(400).json({ message: 'Invalid package selected' });
        }

        // Get user
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Generate unique order ID
        const orderId = `ORDER_${Date.now()}_${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

        // Create Razorpay order
        const options = {
            amount: selectedPackage.price * 100, // Amount in paise (₹1 = 100 paise)
            currency: 'INR',
            receipt: orderId,
            notes: {
                userId: user._id.toString(),
                packageId: selectedPackage.id,
                upcoins: selectedPackage.upcoins,
                userEmail: user.email,
                userName: user.name
            }
        };

        const razorpayOrder = await razorpayInstance.orders.create(options);

        // Save payment record in database
        const payment = new Payment({
            user: user._id,
            orderId: orderId,
            razorpayOrderId: razorpayOrder.id,
            packageId: selectedPackage.id,
            upcoins: selectedPackage.upcoins,
            amount: selectedPackage.price,
            currency: 'INR',
            status: 'created',
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
            metadata: {
                packageDescription: selectedPackage.description,
                discount: selectedPackage.discount
            }
        });

        await payment.save();

        res.json({
            success: true,
            order: {
                id: razorpayOrder.id,
                orderId: orderId,
                amount: razorpayOrder.amount,
                currency: razorpayOrder.currency,
                packageId: selectedPackage.id,
                upcoins: selectedPackage.upcoins
            },
            key: process.env.RAZORPAY_KEY_ID
        });
    } catch (err) {
        console.error('Error creating order:', err.message);
        res.status(500).json({
            message: 'Failed to create order',
            error: err.message
        });
    }
});

/**
 * @route   POST /api/payment/verify
 * @desc    Verify Razorpay payment and credit UpCoins
 * @access  Private
 */
router.post('/verify', auth, async(req, res) => {
    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            orderId
        } = req.body;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !orderId) {
            return res.status(400).json({ message: 'Missing payment details' });
        }

        // Find payment record
        const payment = await Payment.findOne({
            orderId: orderId,
            user: req.user.id
        });

        if (!payment) {
            return res.status(404).json({ message: 'Payment record not found' });
        }

        // Verify payment signature
        const generatedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest('hex');

        if (generatedSignature !== razorpay_signature) {
            // Mark payment as failed
            await payment.markAsFailed('Invalid signature');
            return res.status(400).json({
                success: false,
                message: 'Payment verification failed. Invalid signature.'
            });
        }

        // Fetch payment details from Razorpay to get payment method
        let paymentMethod = 'unknown';
        try {
            const razorpayPayment = await razorpayInstance.payments.fetch(razorpay_payment_id);
            paymentMethod = razorpayPayment.method || 'unknown';
        } catch (error) {
            console.error('Error fetching payment details:', error.message);
        }

        // Mark payment as successful
        await payment.markAsSuccess(razorpay_payment_id, razorpay_signature, paymentMethod);

        // Find the package to get bonus coins
        const selectedPackage = UPCOIN_PACKAGES.find(pkg => pkg.id === payment.packageId);
        const totalCoins = selectedPackage ? selectedPackage.totalCoins : payment.upcoins;
        const bonusCoins = selectedPackage ? selectedPackage.bonusCoins : 0;

        // Credit UpCoins (including bonus) to user's wallet
        const user = await User.findById(req.user.id);
        user.walletBalance += totalCoins;
        user.totalEarned += totalCoins;
        await user.save();

        // Create transaction record
        const bonusDescription = bonusCoins > 0 
            ? `Purchased ${payment.upcoins} UpCoins + ${bonusCoins} bonus for ₹${payment.amount}`
            : `Purchased ${totalCoins} UpCoins for ₹${payment.amount}`;
        
        const transaction = new Transaction({
            user: user._id,
            type: 'credit',
            amount: totalCoins,
            realMoneyAmount: payment.amount,
            currency: payment.currency,
            description: bonusDescription,
            category: 'upcoin_purchase',
            status: 'completed',
            paymentMethod: paymentMethod,
            reference: razorpay_payment_id,
            balanceBefore: user.walletBalance - totalCoins,
            balanceAfter: user.walletBalance,
            metadata: {
                paymentId: payment._id,
                razorpayPaymentId: razorpay_payment_id,
                razorpayOrderId: razorpay_order_id,
                packageId: payment.packageId,
                baseCoins: payment.upcoins,
                bonusCoins: bonusCoins,
                totalCoins: totalCoins,
                amountPaid: payment.amount,
                currency: payment.currency
            }
        });
        await transaction.save();

        const successMessage = bonusCoins > 0
            ? `Successfully purchased ${payment.upcoins} + ${bonusCoins} bonus UpCoins!`
            : `Successfully purchased ${totalCoins} UpCoins!`;

        res.json({
            success: true,
            message: successMessage,
            payment: {
                id: payment._id,
                upcoins: payment.upcoins,
                bonusCoins: bonusCoins,
                totalCoins: totalCoins,
                amount: payment.amount,
                status: payment.status
            },
            wallet: {
                balance: user.walletBalance,
                totalEarned: user.totalEarned
            }
        });
    } catch (err) {
        console.error('Error verifying payment:', err.message);
        res.status(500).json({
            message: 'Payment verification failed',
            error: err.message
        });
    }
});

/**
 * @route   GET /api/payment/history
 * @desc    Get user's payment history
 * @access  Private
 */
router.get('/history', auth, async(req, res) => {
    try {
        const { status, limit = 20, page = 1 } = req.query;

        const query = { user: req.user.id };
        if (status) {
            query.status = status;
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const payments = await Payment.find(query)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip(skip)
            .select('-razorpaySignature -userAgent -ipAddress');

        const total = await Payment.countDocuments(query);

        res.json({
            success: true,
            payments,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (err) {
        console.error('Error fetching payment history:', err.message);
        res.status(500).json({ message: 'Server error' });
    }
});

/**
 * @route   GET /api/payment/stats
 * @desc    Get user's payment statistics
 * @access  Private
 */
router.get('/stats', auth, async(req, res) => {
    try {
        const userId = req.user.id;

        const stats = await Payment.aggregate([
            { $match: { user: mongoose.Types.ObjectId(userId) } },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                    totalAmount: { $sum: '$amount' },
                    totalUpcoins: { $sum: '$upcoins' }
                }
            }
        ]);

        const formattedStats = {
            total: 0,
            successful: 0,
            failed: 0,
            pending: 0,
            totalSpent: 0,
            totalUpcoinsPurchased: 0
        };

        stats.forEach(stat => {
            formattedStats.total += stat.count;
            if (stat._id === 'success') {
                formattedStats.successful = stat.count;
                formattedStats.totalSpent = stat.totalAmount;
                formattedStats.totalUpcoinsPurchased = stat.totalUpcoins;
            } else if (stat._id === 'failed') {
                formattedStats.failed = stat.count;
            } else if (stat._id === 'pending' || stat._id === 'created') {
                formattedStats.pending += stat.count;
            }
        });

        res.json({
            success: true,
            stats: formattedStats
        });
    } catch (err) {
        console.error('Error fetching payment stats:', err.message);
        res.status(500).json({ message: 'Server error' });
    }
});

/**
 * @route   POST /api/payment/webhook
 * @desc    Handle Razorpay webhooks
 * @access  Public (but verified)
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async(req, res) => {
    try {
        const signature = req.headers['x-razorpay-signature'];
        const body = req.body.toString();

        // Verify webhook signature
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET || '')
            .update(body)
            .digest('hex');

        if (signature !== expectedSignature) {
            return res.status(400).json({ message: 'Invalid signature' });
        }

        const event = JSON.parse(body);

        // Handle different webhook events
        switch (event.event) {
            case 'payment.captured':
                // Payment was successful
                console.log('Payment captured:', event.payload.payment.entity.id);
                break;

            case 'payment.failed':
                // Payment failed
                const failedPayment = await Payment.findOne({
                    razorpayOrderId: event.payload.payment.entity.order_id
                });
                if (failedPayment) {
                    await failedPayment.markAsFailed(
                        event.payload.payment.entity.error_description || 'Payment failed'
                    );
                }
                break;

            default:
                console.log('Unhandled webhook event:', event.event);
        }

        res.json({ success: true });
    } catch (err) {
        console.error('Webhook error:', err.message);
        res.status(500).json({ message: 'Webhook processing failed' });
    }
});

module.exports = router;