const express = require('express');
const router = express.Router();

// Health check route
router.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

// Test route for debugging client requests
router.post('/test', (req, res) => {
    console.log('Test request received:', {
        body: req.body,
        headers: req.headers
    });
    res.json({ message: 'Test successful', received: req.body });
});

// Example route
router.get('/example', (req, res) => {
    res.json({ message: 'This is an example API endpoint' });
});

// Auth routes
router.use('/auth', require('./auth'));

// Lectures routes
router.use('/lectures', require('./lectures'));

// Wallet routes
router.use('/wallet', require('./wallet'));

// Admin routes
router.use('/admin', require('./admin'));

// Trainer routes
router.use('/trainer', require('./trainer'));

// Payment routes
router.use('/payment', require('./payment'));

// Support routes
router.use('/support', require('./support'));

// Add more routes as needed

module.exports = router;