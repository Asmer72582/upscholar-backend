const nodemailer = require('nodemailer');
require('dotenv').config();

// Create transporter (using Gmail as example - you can change this)
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || 'your-email@gmail.com',
        pass: process.env.EMAIL_PASS || 'your-app-password'
    }
});

// Email templates
const emailTemplates = {
        trainerApproval: (trainerName, email, tempPassword) => ({
            subject: 'Welcome to Upscholer - Your Trainer Account is Approved!',
            html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Congratulations, ${trainerName}!</h2>
        <p>We're excited to inform you that your trainer application has been approved!</p>
        
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #1f2937; margin-top: 0;">Your Login Credentials:</h3>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Temporary Password:</strong> <code style="background-color: #e5e7eb; padding: 4px 8px; border-radius: 4px;">${tempPassword}</code></p>
        </div>
        
        <p><strong>Important:</strong> Please change your password after your first login for security purposes.</p>
        
        <p>You can now:</p>
        <ul>
          <li>Create and manage your courses</li>
          <li>Schedule live lectures</li>
          <li>Interact with students</li>
          <li>Track your earnings</li>
        </ul>
        
        <p>Welcome to the Upscholer community! We're looking forward to seeing the amazing content you'll create.</p>
        
        <p>Best regards,<br>The Upscholer Team</p>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        <p style="color: #6b7280; font-size: 12px;">
          If you have any questions, please contact us at support@upscholer.com
        </p>
      </div>
    `
        }),

        trainerRejection: (trainerName, email, reason) => ({
                    subject: 'Update on Your Upscholer Trainer Application',
                    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">Application Update</h2>
        <p>Dear ${trainerName},</p>
        
        <p>Thank you for your interest in becoming a trainer on Upscholer. After careful review of your application, we regret to inform you that we cannot approve your trainer account at this time.</p>
        
        ${reason ? `<div style="background-color: #fef2f2; padding: 15px; border-left: 4px solid #dc2626; margin: 20px 0;">
          <p><strong>Reason:</strong> ${reason}</p>
        </div>` : ''}
        
        <p>We encourage you to:</p>
        <ul>
          <li>Review our trainer guidelines</li>
          <li>Enhance your qualifications or experience</li>
          <li>Reapply in the future</li>
        </ul>
        
        <p>You're still welcome to use Upscholer as a student to learn from our amazing trainers.</p>
        
        <p>Thank you for your understanding.</p>
        
        <p>Best regards,<br>The Upscholer Team</p>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        <p style="color: #6b7280; font-size: 12px;">
          If you have any questions, please contact us at support@upscholer.com
        </p>
      </div>
    `
  })
};

const sendEmail = async (to, template) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER || 'noreply@upscholer.com',
      to: to,
      subject: template.subject,
      html: template.html
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendEmail,
  emailTemplates
};