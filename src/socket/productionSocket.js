/**
 * Production-ready Socket.IO configuration for WebRTC signaling
 * Handles HTTPS, secure contexts, and proper error handling
 */

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

let io;

// Store active meetings and participants with memory management
const meetings = new Map();
const MAX_MEETING_DURATION = 4 * 60 * 60 * 1000; // 4 hours
const MEETING_CLEANUP_INTERVAL = 30 * 60 * 1000; // 30 minutes

/**
 * Production Socket.IO configuration
 */
const initializeProductionSocket = (server) => {
    const allowedOrigins = [
        process.env.FRONTEND_URL || 'http://localhost:8080',
        'https://upscholar-ui-kit.vercel.app',
        'https://upscholar.in',
        'http://localhost:8080',
        'http://127.0.0.1:8080',
        'http://localhost:5173'
    ];

    console.log('🔧 Socket.IO Allowed Origins:', allowedOrigins);

    io = new Server(server, {
        cors: {
            origin: allowedOrigins,
            methods: ['GET', 'POST', 'OPTIONS'],
            credentials: true,
            allowedHeaders: [
                'Content-Type',
                'x-auth-token',
                'Authorization',
                'X-Requested-With',
                'Accept',
                'Origin'
            ]
        },
        // Production Socket.IO settings
        transports: ['websocket', 'polling'], // Prefer websocket
        pingTimeout: 60000, // 60 seconds
        pingInterval: 25000, // 25 seconds
        upgradeTimeout: 10000, // 10 seconds
        maxHttpBufferSize: 1e6, // 1MB
        serveClient: false, // Don't serve socket.io client
        allowEIO3: true, // Allow Engine.IO v3 for compatibility
        // Connection state recovery
        connectionStateRecovery: {
            maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
            skipMiddlewares: true,
        }
    });

    // Authentication middleware
    io.use(async(socket, next) => {
        try {
            const token = socket.handshake.auth.token || socket.handshake.headers['x-auth-token'];

            if (!token) {
                console.warn('❌ No authentication token provided');
                return next(new Error('Authentication error: No token provided'));
            }

            // Verify JWT token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            socket.userId = decoded.userId;
            socket.userRole = decoded.role;
            socket.userName = decoded.name;

            console.log('✅ Socket authenticated:', socket.userId, socket.userName);
            next();
        } catch (error) {
            console.error('❌ Socket authentication failed:', error.message);
            next(new Error('Authentication error: Invalid token'));
        }
    });

    // Handle connections
    io.on('connection', (socket) => {
        console.log('🔌 User connected:', socket.id, socket.userName);

        // Join meeting room
        socket.on('join-meeting', async({ lectureId }) => {
            try {
                console.log(`📋 ${socket.userName} joining meeting:`, lectureId);

                if (!lectureId) {
                    socket.emit('error', { message: 'Lecture ID is required' });
                    return;
                }

                // Initialize meeting if it doesn't exist
                if (!meetings.has(lectureId)) {
                    meetings.set(lectureId, {
                        id: lectureId,
                        participants: new Map(),
                        host: socket.userRole === 'trainer' ? socket.id : null,
                        whiteboard: [],
                        chat: [],
                        createdAt: new Date(),
                        lastActivity: new Date()
                    });
                }

                const meeting = meetings.get(lectureId);

                // Check if meeting is expired
                if (isMeetingExpired(meeting)) {
                    socket.emit('error', { message: 'Meeting has expired' });
                    return;
                }

                // Add participant
                meeting.participants.set(socket.id, {
                    userId: socket.userId,
                    userName: socket.userName,
                    userRole: socket.userRole,
                    socketId: socket.id,
                    video: true,
                    audio: true,
                    screen: false,
                    joinedAt: new Date()
                });

                socket.join(lectureId);
                meeting.lastActivity = new Date();

                console.log(`✅ ${socket.userName} joined meeting ${lectureId}`);

                // Send current participants to new joiner
                const participantsArray = Array.from(meeting.participants.values())
                    .filter(p => p.socketId !== socket.id);

                socket.emit('meeting-joined', {
                    isHost: meeting.host === socket.id,
                    participants: participantsArray,
                    whiteboard: meeting.whiteboard,
                    chat: meeting.chat.slice(-50) // Last 50 messages
                });

                // Notify other participants
                socket.to(lectureId).emit('user-joined', {
                    socketId: socket.id,
                    userId: socket.userId,
                    userName: socket.userName,
                    userRole: socket.userRole
                });

            } catch (error) {
                console.error('❌ Error joining meeting:', error);
                socket.emit('error', { message: 'Failed to join meeting' });
            }
        });

        // WebRTC signaling handlers
        socket.on('offer', ({ to, offer }) => {
            console.log(`📤 ${socket.userName} sending offer to ${to}`);
            socket.to(to).emit('offer', {
                from: socket.id,
                offer,
                fromName: socket.userName
            });
        });

        socket.on('answer', ({ to, answer }) => {
            console.log(`📤 ${socket.userName} sending answer to ${to}`);
            socket.to(to).emit('answer', {
                from: socket.id,
                answer
            });
        });

        socket.on('ice-candidate', ({ to, candidate }) => {
            console.log(`🧊 ${socket.userName} sending ICE candidate to ${to}`);
            socket.to(to).emit('ice-candidate', {
                from: socket.id,
                candidate
            });
        });

        // Chat messages
        socket.on('chat-message', ({ lectureId, message }) => {
            try {
                const meeting = meetings.get(lectureId);
                if (!meeting) return;

                const chatMessage = {
                    id: Date.now(),
                    userId: socket.userId,
                    userName: socket.userName,
                    message: message.slice(0, 1000), // Limit message length
                    timestamp: new Date().toISOString()
                };

                meeting.chat.push(chatMessage);
                meeting.lastActivity = new Date();

                // Keep only last 100 messages
                if (meeting.chat.length > 100) {
                    meeting.chat = meeting.chat.slice(-100);
                }

                socket.to(lectureId).emit('chat-message', chatMessage);
            } catch (error) {
                console.error('❌ Error handling chat message:', error);
            }
        });

        // Video/Audio toggle
        socket.on('video-toggle', ({ lectureId, enabled }) => {
            socket.to(lectureId).emit('video-toggle', {
                userId: socket.userId,
                enabled
            });
        });

        socket.on('audio-toggle', ({ lectureId, enabled }) => {
            socket.to(lectureId).emit('audio-toggle', {
                userId: socket.userId,
                enabled
            });
        });

        // Screen sharing
        socket.on('screen-share-started', ({ lectureId }) => {
            console.log(`📺 ${socket.userName} started screen sharing`);
            socket.to(lectureId).emit('screen-share-started', {
                userId: socket.userId,
                userName: socket.userName
            });
        });

        socket.on('screen-share-stopped', ({ lectureId }) => {
            console.log(`📺 ${socket.userName} stopped screen sharing`);
            socket.to(lectureId).emit('screen-share-stopped', {
                userId: socket.userId
            });
        });

        // Whiteboard
        socket.on('whiteboard-update', ({ lectureId, data }) => {
            try {
                const meeting = meetings.get(lectureId);
                if (!meeting) return;

                meeting.whiteboard.push(data);
                meeting.lastActivity = new Date();

                // Keep only last 500 whiteboard actions
                if (meeting.whiteboard.length > 500) {
                    meeting.whiteboard = meeting.whiteboard.slice(-500);
                }

                socket.to(lectureId).emit('whiteboard-update', data);
            } catch (error) {
                console.error('❌ Error handling whiteboard update:', error);
            }
        });

        // Handle disconnection
        socket.on('disconnect', () => {
            console.log('🔌 User disconnected:', socket.id, socket.userName);

            // Remove from all meetings
            meetings.forEach((meeting, lectureId) => {
                if (meeting.participants.has(socket.id)) {
                    meeting.participants.delete(socket.id);

                    // Notify other participants
                    socket.to(lectureId).emit('user-left', {
                        socketId: socket.id,
                        userId: socket.userId,
                        userName: socket.userName
                    });

                    // If host disconnected, assign new host
                    if (meeting.host === socket.id && meeting.participants.size > 0) {
                        const firstParticipant = meeting.participants.values().next().value;
                        meeting.host = firstParticipant.socketId;

                        socket.to(lectureId).emit('host-changed', {
                            newHostId: firstParticipant.socketId,
                            newHostName: firstParticipant.userName
                        });
                    }

                    // Clean up empty meetings after delay
                    if (meeting.participants.size === 0) {
                        setTimeout(() => {
                            if (meeting.participants.size === 0) {
                                meetings.delete(lectureId);
                                console.log(`🗑️ Cleaned up empty meeting: ${lectureId}`);
                            }
                        }, 60000); // 1 minute delay
                    }
                }
            });
        });

        // Error handling
        socket.on('error', (error) => {
            console.error('❌ Socket error:', socket.id, error);
        });
    });

    // Periodic cleanup of expired meetings
    setInterval(() => {
        const now = new Date();
        let cleanedCount = 0;

        meetings.forEach((meeting, lectureId) => {
            if (isMeetingExpired(meeting)) {
                meetings.delete(lectureId);
                cleanedCount++;

                // Notify remaining participants
                io.to(lectureId).emit('meeting-ended', {
                    reason: 'Meeting expired'
                });
            }
        });

        if (cleanedCount > 0) {
            console.log(`🧹 Cleaned up ${cleanedCount} expired meetings`);
        }
    }, MEETING_CLEANUP_INTERVAL);

    console.log('✅ Production Socket.IO initialized');
    return io;
};

/**
 * Check if meeting has expired
 */
const isMeetingExpired = (meeting) => {
    const now = new Date();
    const meetingAge = now - meeting.createdAt;
    const lastActivityAge = now - meeting.lastActivity;

    // Expire if meeting is too old OR no activity for 1 hour
    return meetingAge > MAX_MEETING_DURATION || lastActivityAge > 60 * 60 * 1000;
};

/**
 * Get current meetings (for debugging/admin)
 */
const getMeetings = () => {
    return Array.from(meetings.entries()).map(([id, meeting]) => ({
        id,
        host: meeting.host,
        participantCount: meeting.participants.size,
        createdAt: meeting.createdAt,
        lastActivity: meeting.lastActivity,
        isExpired: isMeetingExpired(meeting)
    }));
};

module.exports = {
    initializeProductionSocket,
    getMeetings
};