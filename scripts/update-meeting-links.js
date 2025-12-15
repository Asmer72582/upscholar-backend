/**
 * Script to update meeting links from localhost to production URL
 * Run this script to fix existing lectures with localhost meeting links
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Lecture = require('../src/models/Lecture');

const updateMeetingLinks = async() => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        // Find all lectures with localhost meeting links
        const lecturesToUpdate = await Lecture.find({
            meetingLink: { $regex: /localhost:8080/ }
        });

        console.log(`Found ${lecturesToUpdate.length} lectures with localhost meeting links`);

        // Update each lecture
        let updatedCount = 0;
        for (const lecture of lecturesToUpdate) {
            const oldMeetingLink = lecture.meetingLink;
            const newMeetingLink = oldMeetingLink.replace('http://localhost:8080', process.env.FRONTEND_URL || 'https://upscholar.in');

            lecture.meetingLink = newMeetingLink;
            await lecture.save();

            console.log(`Updated lecture ${lecture._id}: ${oldMeetingLink} → ${newMeetingLink}`);
            updatedCount++;
        }

        console.log(`Successfully updated ${updatedCount} lectures`);

        // Also find lectures with other localhost variations
        const otherLectures = await Lecture.find({
            $or: [
                { meetingLink: { $regex: /localhost:3000/ } },
                { meetingLink: { $regex: /localhost:5173/ } },
                { meetingLink: { $regex: /127\.0\.0\.1/ } }
            ]
        });

        console.log(`Found ${otherLectures.length} lectures with other localhost variations`);

        for (const lecture of otherLectures) {
            const oldMeetingLink = lecture.meetingLink;
            let newMeetingLink = oldMeetingLink;

            // Replace various localhost patterns
            newMeetingLink = newMeetingLink.replace(/http:\/\/localhost:3000/g, process.env.FRONTEND_URL || 'https://upscholar.in');
            newMeetingLink = newMeetingLink.replace(/http:\/\/localhost:5173/g, process.env.FRONTEND_URL || 'https://upscholar.in');
            newMeetingLink = newMeetingLink.replace(/http:\/\/127\.0\.0\.1:8080/g, process.env.FRONTEND_URL || 'https://upscholar.in');
            newMeetingLink = newMeetingLink.replace(/http:\/\/127\.0\.0\.1:8081/g, process.env.FRONTEND_URL || 'https://upscholar.in');

            if (newMeetingLink !== oldMeetingLink) {
                lecture.meetingLink = newMeetingLink;
                await lecture.save();
                console.log(`Updated lecture ${lecture._id}: ${oldMeetingLink} → ${newMeetingLink}`);
                updatedCount++;
            }
        }

        console.log(`Total lectures updated: ${updatedCount}`);

    } catch (error) {
        console.error('Error updating meeting links:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
};

// Run the script
updateMeetingLinks();