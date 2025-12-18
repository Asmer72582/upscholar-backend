const express = require('express');
const router = express.Router();

// Support routes placeholder
// TODO: Implement support ticket routes

router.get('/', (req, res) => {
    res.json({ message: 'Support routes - coming soon' });
});

module.exports = router;