// 🔧 Socket.io Connection Test Script
const io = require('socket.io-client');

const SOCKET_URL = 'https://api.upscholar.in';

console.log('🧪 Testing Socket.io Connection...');
console.log('=====================================');

// Test connection with detailed logging
const socket = io(SOCKET_URL, {
    transports: ['websocket', 'polling'],
    timeout: 10000,
    forceNew: true,
    reconnection: false
});

socket.on('connect', () => {
    console.log('✅ Connected successfully!');
    console.log('Socket ID:', socket.id);
    console.log('Connected to:', SOCKET_URL);
    socket.disconnect();
    process.exit(0);
});

socket.on('connect_error', (error) => {
    console.error('❌ Connection failed:', error.message);
    console.error('Error type:', error.type);
    console.error('Transport:', socket.io.engine.transport.name);
    process.exit(1);
});

socket.on('error', (error) => {
    console.error('❌ Socket error:', error);
    process.exit(1);
});

socket.on('reconnect_attempt', (attempt) => {
    console.log('🔄 Reconnection attempt:', attempt);
});

// Timeout after 15 seconds
setTimeout(() => {
    console.error('⏰ Connection timeout');
    console.error('Current transport:', socket.io.engine ? .transport ? .name || 'unknown');
    socket.disconnect();
    process.exit(1);
}, 15000);

console.log('Connecting to:', SOCKET_URL);
console.log('Available transports:', socket.io.opts.transports);