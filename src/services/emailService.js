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
            subject: 'Welcome to Upscholar - Your Trainer Account is Approved!',
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
        
        <p>Welcome to the Upscholar community! We're looking forward to seeing the amazing content you'll create.</p>
        
        <p>Best regards,<br>The Upscholar Team</p>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        <p style="color: #6b7280; font-size: 12px;">
          If you have any questions, please contact us at support@upscholar.com
        </p>
      </div>
    `
        }),

        trainerRejection: (trainerName, email, reason) => ({
                    subject: 'Update on Your Upscholar Trainer Application',
                    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">Application Update</h2>
        <p>Dear ${trainerName},</p>
        
        <p>Thank you for your interest in becoming a trainer on Upscholar. After careful review of your application, we regret to inform you that we cannot approve your trainer account at this time.</p>
        
        ${reason ? `<div style="background-color: #fef2f2; padding: 15px; border-left: 4px solid #dc2626; margin: 20px 0;">
          <p><strong>Reason:</strong> ${reason}</p>
        </div>` : ''}
        
        <p>We encourage you to:</p>
        <ul>
          <li>Review our trainer guidelines</li>
          <li>Enhance your qualifications or experience</li>
          <li>Reapply in the future</li>
        </ul>
        
        <p>You're still welcome to use Upscholar as a student to learn from our amazing trainers.</p>
        
        <p>Thank you for your understanding.</p>
        
        <p>Best regards,<br>The Upscholar Team</p>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        <p style="color: #6b7280; font-size: 12px;">
          If you have any questions, please contact us at support@upscholar.com
        </p>
      </div>
    `
  }),
  otpVerification: (email, otp) => ({
    subject: 'Verify Your Email - Upscholar',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">Upscholar</h1>
        </div>
        <div style="background-color: #ffffff; padding: 40px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
          <h2 style="color: #1f2937; margin-top: 0;">Email Verification</h2>
          <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
            Thank you for registering with Upscholar! To complete your registration, please verify your email address using the OTP below:
          </p>
          <div style="background-color: #f3f4f6; padding: 30px; border-radius: 8px; text-align: center; margin: 30px 0;">
            <div style="font-size: 36px; font-weight: bold; color: #667eea; letter-spacing: 8px; font-family: 'Courier New', monospace;">
              ${otp}
            </div>
          </div>
          <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
            <strong>Important:</strong>
          </p>
          <ul style="color: #6b7280; font-size: 14px; line-height: 1.8;">
            <li>This OTP is valid for <strong>10 minutes</strong> only</li>
            <li>Do not share this OTP with anyone</li>
            <li>If you didn't request this OTP, please ignore this email</li>
          </ul>
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
              This is an automated email. Please do not reply to this message.
            </p>
          </div>
        </div>
        <div style="text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px;">
          <p>© 2024 Upscholar. All rights reserved.</p>
        </div>
      </div>
    `
  })
};

const sendEmail = async (to, template) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER || 'noreply@upscholar.com',
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