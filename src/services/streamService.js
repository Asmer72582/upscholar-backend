/**
 * GetStream.io Video Service
 * Handles token generation and call management for video meetings
 */

const { StreamClient } = require('@stream-io/node-sdk');
const { STREAM_API_KEY, STREAM_API_SECRET } = require('../config/stream');

let streamClient = null;

/**
 * Initialize Stream client (lazy initialization)
 */
const getStreamClient = () => {
    if (!streamClient && STREAM_API_KEY && STREAM_API_SECRET) {
        streamClient = new StreamClient(STREAM_API_KEY, STREAM_API_SECRET);
    }
    return streamClient;
};

/**
 * Generate a user token for Stream Video
 * @param {string} userId - The user's ID
 * @returns {string} - JWT token for Stream authentication
 */
const generateUserToken = (userId) => {
    const client = getStreamClient();
    if (!client) {
        throw new Error('Stream client not initialized. Check STREAM_API_KEY and STREAM_API_SECRET');
    }
    
    // Token validity: 24 hours
    const expirationTime = Math.floor(Date.now() / 1000) + 60 * 60 * 24;
    const issuedAt = Math.floor(Date.now() / 1000) - 60; // 1 minute in the past to account for clock skew
    
    return client.createToken(userId, expirationTime, issuedAt);
};

/**
 * Create or get a video call
 * @param {string} callId - Unique call identifier (usually lecture ID)
 * @param {object} callData - Additional call data
 * @returns {object} - Call information
 */
const createOrGetCall = async (callId, callData = {}) => {
    const client = getStreamClient();
    if (!client) {
        throw new Error('Stream client not initialized');
    }

    try {
        const call = client.video.call('default', callId);
        
        await call.getOrCreate({
            data: {
                created_by_id: callData.createdBy || 'system',
                custom: {
                    title: callData.title || 'Video Meeting',
                    description: callData.description || '',
                    lectureId: callData.lectureId || callId
                },
                members: callData.members || []
            },
            ring: false
        });

        return {
            callId,
            callType: 'default'
        };
    } catch (error) {
        console.error('Error creating/getting call:', error);
        throw error;
    }
};

/**
 * End a video call
 * @param {string} callId - The call ID to end
 */
const endCall = async (callId) => {
    const client = getStreamClient();
    if (!client) {
        throw new Error('Stream client not initialized');
    }

    try {
        const call = client.video.call('default', callId);
        await call.endCall();
        return { success: true };
    } catch (error) {
        console.error('Error ending call:', error);
        throw error;
    }
};

/**
 * Update user information in Stream
 * @param {string} userId - User ID
 * @param {object} userData - User data to update
 */
const upsertUser = async (userId, userData) => {
    const client = getStreamClient();
    if (!client) {
        throw new Error('Stream client not initialized');
    }

    try {
        // Stream SDK expects an array of users
        await client.upsertUsers([
            {
                id: userId,
                name: userData.name || 'Anonymous',
                image: userData.image || undefined,
                role: userData.role || 'user',
                custom: {
                    email: userData.email
                }
            }
        ]);
        return { success: true };
    } catch (error) {
        console.error('Error upserting user:', error);
        // Don't throw - user upsert is not critical for token generation
        console.warn('User upsert failed, continuing with token generation...');
        return { success: false, error: error.message };
    }
};

/**
 * Check if Stream is configured
 */
const isConfigured = () => {
    return !!(STREAM_API_KEY && STREAM_API_SECRET);
};

module.exports = {
    generateUserToken,
    createOrGetCall,
    endCall,
    upsertUser,
    isConfigured,
    STREAM_API_KEY
};

