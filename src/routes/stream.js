/**
 * GetStream.io Video Routes
 * Handles token generation and call management for video meetings
 */

const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const streamService = require('../services/streamService');
const User = require('../models/User');

/**
 * @route   GET /api/stream/token
 * @desc    Get a Stream video token for the authenticated user
 * @access  Private
 */
router.get('/token', auth, async (req, res) => {
    try {
        // Check if Stream is configured
        if (!streamService.isConfigured()) {
            return res.status(503).json({ 
                message: 'Video service not configured. Please contact support.' 
            });
        }

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Create/update user in Stream
        const userId = user._id.toString();
        await streamService.upsertUser(userId, {
            name: `${user.firstname} ${user.lastname}`,
            image: user.avatar,
            email: user.email,
            role: user.role
        });

        // Generate token
        const token = streamService.generateUserToken(userId);

        res.json({
            token,
            userId,
            apiKey: streamService.STREAM_API_KEY,
            user: {
                id: userId,
                name: `${user.firstname} ${user.lastname}`,
                image: user.avatar,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Error generating Stream token:', error);
        res.status(500).json({ message: 'Failed to generate video token' });
    }
});

/**
 * @route   POST /api/stream/call/:callId
 * @desc    Create or get a video call
 * @access  Private
 */
router.post('/call/:callId', auth, async (req, res) => {
    try {
        if (!streamService.isConfigured()) {
            return res.status(503).json({ 
                message: 'Video service not configured. Please contact support.' 
            });
        }

        const { callId } = req.params;
        const { title, description } = req.body;

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const callData = {
            createdBy: user._id.toString(),
            title: title || 'Video Meeting',
            description: description || '',
            lectureId: callId
        };

        const call = await streamService.createOrGetCall(callId, callData);

        res.json({
            success: true,
            call,
            apiKey: streamService.STREAM_API_KEY
        });
    } catch (error) {
        console.error('Error creating call:', error);
        res.status(500).json({ message: 'Failed to create video call' });
    }
});

/**
 * @route   POST /api/stream/call/:callId/end
 * @desc    End a video call (trainer/host only)
 * @access  Private
 */
router.post('/call/:callId/end', auth, async (req, res) => {
    try {
        if (!streamService.isConfigured()) {
            return res.status(503).json({ 
                message: 'Video service not configured. Please contact support.' 
            });
        }

        const { callId } = req.params;
        
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Only trainers and admins can end calls
        if (user.role !== 'trainer' && user.role !== 'admin') {
            return res.status(403).json({ message: 'Only trainers can end meetings' });
        }

        await streamService.endCall(callId);

        res.json({
            success: true,
            message: 'Meeting ended successfully'
        });
    } catch (error) {
        console.error('Error ending call:', error);
        res.status(500).json({ message: 'Failed to end video call' });
    }
});

/**
 * @route   GET /api/stream/status
 * @desc    Check if Stream video service is configured
 * @access  Public
 */
router.get('/status', (req, res) => {
    res.json({
        configured: streamService.isConfigured(),
        service: 'GetStream.io Video'
    });
});

module.exports = router;

