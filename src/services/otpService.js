const OTP = require('../models/OTP');
const { sendEmail, emailTemplates } = require('./emailService');
const crypto = require('crypto');

/**
 * Generate a 6-digit OTP
 */
const generateOTP = () => {
  return crypto.randomInt(100000, 999999).toString();
};

/**
 * Send OTP to email
 */
const sendOTP = async (email, mobile, ipAddress, purpose = 'registration') => {
  try {
    // Check if there's a recent unverified OTP for this email/IP
    const recentOTP = await OTP.findOne({
      email: email.toLowerCase(),
      ipAddress,
      verified: false,
      expiresAt: { $gt: new Date() }
    }).sort({ createdAt: -1 });

    // If OTP was sent in last 60 seconds, prevent spam
    if (recentOTP && (Date.now() - recentOTP.createdAt.getTime()) < 60000) {
      return {
        success: false,
        message: 'Please wait 60 seconds before requesting a new OTP'
      };
    }

    // Generate new OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

    // Invalidate previous OTPs for this email/IP
    await OTP.updateMany(
      {
        email: email.toLowerCase(),
        ipAddress,
        verified: false
      },
      {
        $set: { verified: true } // Mark as used
      }
    );

    // Create new OTP record
    const otpRecord = new OTP({
      email: email.toLowerCase(),
      mobile: mobile || null,
      otp,
      purpose,
      ipAddress,
      expiresAt
    });

    await otpRecord.save();

    // Send OTP via email
    const emailTemplate = emailTemplates.otpVerification(email, otp);
    const emailResult = await sendEmail(email, emailTemplate);

    if (!emailResult.success) {
      await OTP.deleteOne({ _id: otpRecord._id });
      return {
        success: false,
        message: 'Failed to send OTP email. Please try again.'
      };
    }

    return {
      success: true,
      message: 'OTP sent successfully to your email',
      expiresIn: 10 * 60 // 10 minutes in seconds
    };
  } catch (error) {
    console.error('Error sending OTP:', error);
    return {
      success: false,
      message: 'Failed to send OTP. Please try again.'
    };
  }
};

/**
 * Verify OTP
 */
const verifyOTP = async (email, otp, ipAddress, purpose = 'registration') => {
  try {
    const otpRecord = await OTP.findOne({
      email: email.toLowerCase(),
      ipAddress,
      purpose,
      verified: false,
      expiresAt: { $gt: new Date() }
    }).sort({ createdAt: -1 });

    if (!otpRecord) {
      return {
        success: false,
        message: 'Invalid or expired OTP. Please request a new one.'
      };
    }

    // Check attempts
    if (otpRecord.attempts >= 5) {
      await OTP.deleteOne({ _id: otpRecord._id });
      return {
        success: false,
        message: 'Maximum verification attempts exceeded. Please request a new OTP.'
      };
    }

    // Increment attempts
    otpRecord.attempts += 1;

    // Verify OTP
    if (otpRecord.otp !== otp) {
      await otpRecord.save();
      const remainingAttempts = 5 - otpRecord.attempts;
      return {
        success: false,
        message: `Invalid OTP. ${remainingAttempts > 0 ? `${remainingAttempts} attempts remaining.` : 'Please request a new OTP.'}`
      };
    }

    // Mark as verified
    otpRecord.verified = true;
    await otpRecord.save();

    return {
      success: true,
      message: 'OTP verified successfully'
    };
  } catch (error) {
    console.error('Error verifying OTP:', error);
    return {
      success: false,
      message: 'Failed to verify OTP. Please try again.'
    };
  }
};

/**
 * Check if IP address has already registered an account
 */
const checkIPRegistration = async (ipAddress) => {
  try {
    const User = require('../models/User');
    const existingUser = await User.findOne({ registrationIP: ipAddress });
    return {
      exists: !!existingUser,
      email: existingUser?.email || null
    };
  } catch (error) {
    console.error('Error checking IP registration:', error);
    return { exists: false, email: null };
  }
};

/**
 * Get client IP address from request
 */
const getClientIP = (req) => {
  return req.ip || 
         req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
         req.headers['x-real-ip'] || 
         req.connection?.remoteAddress || 
         'unknown';
};

module.exports = {
  sendOTP,
  verifyOTP,
  checkIPRegistration,
  getClientIP
};


