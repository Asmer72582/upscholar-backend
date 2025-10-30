const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

// Initialize express app
const app = express();

// CORS configuration
const allowedOrigins = [
    process.env.FRONTEND_URL || 'http://localhost:8080',
    'https://upscholar-ui-kit.vercel.app',
    'http://127.0.0.1:8080',
    'http://localhost:8080',
    'http://localhost:5173' // Vite dev server
];

// CORS middleware with dynamic origin check
app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.log('CORS blocked origin:', origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-auth-token', 'Authorization'],
    exposedHeaders: ['x-auth-token'],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 200
}));

// Security middleware with CORS-friendly configuration
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' }
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.get('/', (req, res) => {
    res.json({ message: 'Welcome to UpScholar API' });
});

// API routes
app.use('/api', require('./routes'));

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        message: 'Internal Server Error',
        error: process.env.NODE_ENV === 'development' ? err.message : {}
    });
});

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log('Connected to MongoDB to upscholar database');
    })
    .catch((err) => {
        console.error('MongoDB connection error:', err);
    });

// Start server
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Initialize Socket.io for real-time meeting
const { initializeSocket } = require('./socket/meetingSocket');
initializeSocket(server);
console.log('Socket.io initialized for meeting system');

module.exports = app;