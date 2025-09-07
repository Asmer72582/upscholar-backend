const jwt = require('jsonwebtoken');
require('dotenv').config();

// Get JWT secret from environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Middleware to authenticate token
const auth = (req, res, next) => {
  // Get token from header
  const token = req.header('x-auth-token');

  // Check if no token
  if (!token) {
    return res.status(401).json({ message: 'No token, authorization denied' });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);

    // Add user from payload
    req.user = decoded.user;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ user: { id: userId } }, JWT_SECRET, { expiresIn: '24h' });
};

module.exports = { auth, generateToken };