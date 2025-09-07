const express = require('express');
const router = express.Router();

// Health check route
router.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

// Example route
router.get('/example', (req, res) => {
    res.json({ message: 'This is an example API endpoint' });
});

// Auth routes
router.use('/auth', require('./auth'));

// Add more routes as needed

module.exports = router;