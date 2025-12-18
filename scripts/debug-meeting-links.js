require('dotenv').config();
const mongoose = require('mongoose');
const Lecture = require('../src/models/Lecture');

const debugMeetingLinks = async() => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        // Get total lecture count
        const totalLectures = await Lecture.countDocuments();
        console.log(`Total lectures: ${totalLectures}`);

        // Find lectures with meeting links (not null or empty)
        const lecturesWithLinks = await Lecture.find({
            meetingLink: { $exists: true, $ne: null, $ne: '' }
        });
        console.log(`Lectures with meeting links: ${lecturesWithLinks.length}`);

        // Show sample meeting links
        console.log('\nSample meeting links:');
        lecturesWithLinks.slice(0, 5).forEach((lecture, index) => {
            console.log(`${index + 1}. ID: ${lecture._id}`);
            console.log(`   Title: ${lecture.title}`);
            console.log(`   Meeting Link: ${lecture.meetingLink}`);
            console.log(`   Status: ${lecture.status}`);
            console.log('');
        });

        // Check for localhost patterns
        const localhostPatterns = [
            { pattern: /localhost:8080/, name: 'localhost:8080' },
            { pattern: /localhost:3000/, name: 'localhost:3000' },
            { pattern: /localhost:5173/, name: 'localhost:5173' },
            { pattern: /127\.0\.0\.1/, name: '127.0.0.1' }
        ];

        for (const { pattern, name } of localhostPatterns) {
            const count = await Lecture.countDocuments({ meetingLink: { $regex: pattern } });
            console.log(`Lectures with ${name}: ${count}`);
        }

        // Check for production URL
        const prodUrl = process.env.FRONTEND_URL || 'https://upscholar.in';
        const prodCount = await Lecture.countDocuments({ meetingLink: { $regex: new RegExp(prodUrl.replace('https://', '').replace('http://', '')) } });
        console.log(`Lectures with production URL (${prodUrl}): ${prodCount}`);

        // Show all unique meeting link patterns
        const allLinks = await Lecture.find({ meetingLink: { $exists: true, $ne: null, $ne: '' } });
        const uniquePatterns = new Set();
        allLinks.forEach(lecture => {
            if (lecture.meetingLink) {
                // Extract domain/pattern
                const urlMatch = lecture.meetingLink.match(/https?:\/\/([^\/]+)/);
                if (urlMatch) {
                    uniquePatterns.add(urlMatch[1]);
                } else {
                    uniquePatterns.add(lecture.meetingLink.substring(0, 50));
                }
            }
        });

        console.log('\nUnique meeting link patterns found:');
        uniquePatterns.forEach(pattern => console.log(`- ${pattern}`));

    } catch (error) {
        console.error('Error debugging meeting links:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
};

debugMeetingLinks();