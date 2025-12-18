require('dotenv').config();
const mongoose = require('mongoose');
const Lecture = require('../src/models/Lecture');

const checkInvalidLinks = async() => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        // Find lectures with very short or invalid meeting links
        const invalidLinks = await Lecture.find({
            meetingLink: { $exists: true, $ne: null, $ne: '' },
            $or: [
                { meetingLink: { $regex: /^.{1,10}$/ } }, // Very short links
                { meetingLink: { $regex: /^(as|dfa|test|abc|123)$/ } }, // Common test values
                { meetingLink: { $not: { $regex: /^https?:\/\// } } } // Links that don't start with http
            ]
        });

        console.log(`Found ${invalidLinks.length} lectures with potentially invalid meeting links:`);
        invalidLinks.forEach((lecture, index) => {
            console.log(`${index + 1}. ID: ${lecture._id}`);
            console.log(`   Title: ${lecture.title}`);
            console.log(`   Meeting Link: "${lecture.meetingLink}"`);
            console.log(`   Status: ${lecture.status}`);
            console.log(`   Created: ${lecture.createdAt}`);
            console.log(`   Updated: ${lecture.updatedAt}`);
            console.log('');
        });

        // Check if any of these might have been localhost links that got corrupted
        console.log('Checking recent lectures that might have had localhost links...');
        const recentLectures = await Lecture.find({
            createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
        }).sort({ createdAt: -1 });

        console.log(`Recent lectures (last 30 days): ${recentLectures.length}`);
        recentLectures.forEach(lecture => {
            if (lecture.meetingLink && lecture.meetingLink.length < 20) {
                console.log(`Recent lecture with short link: "${lecture.meetingLink}" (Title: ${lecture.title})`);
            }
        });

    } catch (error) {
        console.error('Error checking invalid links:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
};

checkInvalidLinks();