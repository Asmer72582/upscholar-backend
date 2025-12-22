const { Server } = require('socket.io');

let io;

// Store active meetings and participants
const meetings = new Map();

const initializeSocket = (server) => {
    const allowedOrigins = [
        process.env.FRONTEND_URL || 'http://localhost:8080',
        'https://upscholar-ui-kit.vercel.app',
        'https://upscholar.in',
        'http://localhost:8080',
        'http://127.0.0.1:8080',
        'http://localhost:5173'
    ];

    io = new Server(server, {
        cors: {
            origin: allowedOrigins,
            methods: ['GET', 'POST'],
            credentials: true,
            allowedHeaders: ['Content-Type', 'x-auth-token', 'Authorization']
        },
        transports: ['websocket', 'polling'], // Enable both transports
        allowEIO3: true, // Allow Engine.IO v3 compatibility
        pingTimeout: 60000,
        pingInterval: 25000
    });

    io.on('connection', (socket) => {
        console.log('User connected:', socket.id);

        // Join meeting room
        socket.on('join-meeting', ({ meetingId, userId, userName, userRole }) => {
            socket.join(meetingId);

            // Initialize meeting if it doesn't exist
            if (!meetings.has(meetingId)) {
                meetings.set(meetingId, {
                    participants: new Map(),
                    host: userRole === 'trainer' ? socket.id : null,
                    whiteboard: [],
                    chat: []
                });
            }

            const meeting = meetings.get(meetingId);

            // Add participant
            meeting.participants.set(socket.id, {
                userId,
                userName,
                userRole,
                video: true,
                audio: true,
                screen: false
            });

            // Notify others in the room
            socket.to(meetingId).emit('user-joined', {
                socketId: socket.id,
                userId,
                userName,
                userRole
            });

            // Send current participants to the new user
            const participants = Array.from(meeting.participants.entries()).map(([id, data]) => ({
                socketId: id,
                ...data
            }));

            socket.emit('meeting-joined', {
                participants: participants.filter(p => p.socketId !== socket.id),
                whiteboard: meeting.whiteboard,
                chat: meeting.chat,
                isHost: socket.id === meeting.host
            });

            console.log(`User ${userName} joined meeting ${meetingId}`);
        });

        // WebRTC signaling
        socket.on('offer', ({ to, offer }) => {
            socket.to(to).emit('offer', {
                from: socket.id,
                offer
            });
        });

        socket.on('answer', ({ to, answer }) => {
            socket.to(to).emit('answer', {
                from: socket.id,
                answer
            });
        });

        socket.on('ice-candidate', ({ to, candidate }) => {
            socket.to(to).emit('ice-candidate', {
                from: socket.id,
                candidate
            });
        });

        // Media controls
        socket.on('toggle-video', ({ meetingId, enabled }) => {
            const meeting = meetings.get(meetingId);
            if (meeting && meeting.participants.has(socket.id)) {
                meeting.participants.get(socket.id).video = enabled;
                socket.to(meetingId).emit('user-video-toggle', {
                    socketId: socket.id,
                    enabled
                });
            }
        });

        socket.on('toggle-audio', ({ meetingId, enabled }) => {
            const meeting = meetings.get(meetingId);
            if (meeting && meeting.participants.has(socket.id)) {
                meeting.participants.get(socket.id).audio = enabled;
                socket.to(meetingId).emit('user-audio-toggle', {
                    socketId: socket.id,
                    enabled
                });
            }
        });

        socket.on('toggle-screen', ({ meetingId, enabled }) => {
            const meeting = meetings.get(meetingId);
            if (meeting && meeting.participants.has(socket.id)) {
                meeting.participants.get(socket.id).screen = enabled;
                socket.to(meetingId).emit('user-screen-toggle', {
                    socketId: socket.id,
                    enabled
                });
            }
        });

        // Screen sharing
        socket.on('start-screen-share', ({ meetingId }) => {
            socket.to(meetingId).emit('user-started-screen-share', {
                socketId: socket.id
            });
        });

        socket.on('stop-screen-share', ({ meetingId }) => {
            socket.to(meetingId).emit('user-stopped-screen-share', {
                socketId: socket.id
            });
        });

        // Whiteboard
        socket.on('whiteboard-draw', ({ meetingId, data }) => {
            const meeting = meetings.get(meetingId);
            if (meeting) {
                meeting.whiteboard.push(data);
                socket.to(meetingId).emit('whiteboard-draw', data);
            }
        });

        socket.on('whiteboard-clear', ({ meetingId }) => {
            const meeting = meetings.get(meetingId);
            if (meeting) {
                meeting.whiteboard = [];
                socket.to(meetingId).emit('whiteboard-clear');
            }
        });

        socket.on('whiteboard-undo', ({ meetingId }) => {
            const meeting = meetings.get(meetingId);
            if (meeting && meeting.whiteboard.length > 0) {
                meeting.whiteboard.pop();
                io.to(meetingId).emit('whiteboard-sync', meeting.whiteboard);
            }
        });

        // Chat
        socket.on('send-message', ({ meetingId, message, userName }) => {
            const meeting = meetings.get(meetingId);
            if (meeting) {
                const chatMessage = {
                    id: Date.now(),
                    userName,
                    message,
                    timestamp: new Date().toISOString()
                };
                meeting.chat.push(chatMessage);
                io.to(meetingId).emit('new-message', chatMessage);
            }
        });

        // End meeting (host only)
        socket.on('end-meeting', ({ meetingId }) => {
            const meeting = meetings.get(meetingId);
            if (meeting && socket.id === meeting.host) {
                io.to(meetingId).emit('meeting-ended');
                meetings.delete(meetingId);
                console.log(`Meeting ${meetingId} ended by host`);
            }
        });

        // Leave meeting
        socket.on('leave-meeting', ({ meetingId }) => {
            handleUserLeave(socket, meetingId);
        });

        // Disconnect
        socket.on('disconnect', () => {
            console.log('User disconnected:', socket.id);

            // Find and remove user from all meetings
            meetings.forEach((meeting, meetingId) => {
                if (meeting.participants.has(socket.id)) {
                    handleUserLeave(socket, meetingId);
                }
            });
        });
    });

    return io;
};

const handleUserLeave = (socket, meetingId) => {
    const meeting = meetings.get(meetingId);
    if (meeting) {
        const participant = meeting.participants.get(socket.id);
        meeting.participants.delete(socket.id);

        socket.to(meetingId).emit('user-left', {
            socketId: socket.id
        });

        socket.leave(meetingId);

        // If host left, end meeting
        if (socket.id === meeting.host) {
            socket.to(meetingId).emit('meeting-ended');
            meetings.delete(meetingId);
            console.log(`Meeting ${meetingId} ended (host left)`);
        } else if (meeting.participants.size === 0) {
            // Clean up empty meetings
            meetings.delete(meetingId);
            console.log(`Meeting ${meetingId} cleaned up (no participants)`);
        }

        if (participant) {
            console.log(`User ${participant.userName} left meeting ${meetingId}`);
        }
    }
};

const getIO = () => {
    if (!io) {
        throw new Error('Socket.io not initialized');
    }
    return io;
};

module.exports = {
    initializeSocket,
    getIO
};