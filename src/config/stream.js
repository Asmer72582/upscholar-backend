/**
 * GetStream.io Video API Configuration
 * 
 * To set up GetStream.io:
 * 1. Sign up at https://getstream.io/
 * 2. Create a new app in the dashboard
 * 3. Get your API Key and Secret from the dashboard
 * 4. Add them to your .env file:
 *    STREAM_API_KEY=your_api_key
 *    STREAM_API_SECRET=your_api_secret
 */

require('dotenv').config();

const STREAM_API_KEY = process.env.STREAM_API_KEY;
const STREAM_API_SECRET = process.env.STREAM_API_SECRET;

if (!STREAM_API_KEY || !STREAM_API_SECRET) {
    console.warn('⚠️ GetStream.io credentials not configured. Add STREAM_API_KEY and STREAM_API_SECRET to your .env file');
}

module.exports = {
    STREAM_API_KEY,
    STREAM_API_SECRET
};

