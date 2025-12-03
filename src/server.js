const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

// Initialize express app
// Updated: 2025-11-11 - Fixed path-to-regexp errors and route registration
const app = express();

// CORS configuration - Allow multiple origins
const allowedOrigins = [
    'https://upscholar-ui-kit.vercel.app',
    'http://localhost:8080',
    'http://localhost:5173',
    'http://127.0.0.1:8080'
];

// Add environment variable origin if set
if (process.env.FRONTEND_URL) {
    allowedOrigins.push(process.env.FRONTEND_URL);
}

console.log('🔧 CORS Allowed Origins:', allowedOrigins);

// CORS middleware - simplified for production
app.use(cors({
    origin: function(origin, callback) {
        console.log('📨 Request from origin:', origin);

        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin) {
            console.log('✅ Allowing request with no origin');
            return callback(null, true);
        }

        // Check if origin is in allowed list
        if (allowedOrigins.includes(origin)) {
            console.log('✅ Origin allowed:', origin);
            callback(null, true);
        } else {
            console.log('❌ Origin blocked:', origin);
            callback(null, true); // Allow anyway for now to debug
        }
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-auth-token', 'Authorization', 'Accept'],
    exposedHeaders: ['x-auth-token'],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204
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

// Handle preflight requests explicitly - removed wildcard for Express 5 compatibility
// app.options('*', cors());

// Routes
app.get('/', (req, res) => {
    res.json({ message: 'Welcome to UpScholar API' });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        cors: 'enabled',
        allowedOrigins: allowedOrigins
    });
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
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});

// Initialize Socket.io for real-time meeting
const { initializeSocket } = require('./socket/meetingSocket');
initializeSocket(server);
console.log('Socket.io initialized for meeting system');

module.exports = app;