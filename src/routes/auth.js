const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Transaction = require("../models/Transaction");
const { auth, generateToken } = require("../middleware/auth");
const upload = require("../middleware/upload");
const { sendEmail, emailTemplates } = require("../services/emailService");
const { generateTempPassword } = require("../utils/passwordGenerator");
const { JOINING_BONUS } = require("../config/razorpay");
const crypto = require("crypto");
const bcrypt = require("bcrypt");

// Handle preflight requests for specific routes
router.options("/register", (req, res) => {
  res.header("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.header("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, x-auth-token"
  );
  res.header("Access-Control-Allow-Credentials", "true");
  res.sendStatus(200);
});

router.options("/login", (req, res) => {
  res.header("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.header("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, x-auth-token"
  );
  res.header("Access-Control-Allow-Credentials", "true");
  res.sendStatus(200);
});

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post("/register", upload.single("resume"), async (req, res) => {
  try {
    const {
      name,
      firstname,
      lastname,
      email,
      password,
      role,
      // Trainer-specific fields
      demoVideoUrl,
      expertise,
      experience,
      bio,
    } = req.body;

    // Prevent admin registration
    if (role === "admin") {
      return res
        .status(403)
        .json({
          message: "Admin accounts cannot be created through registration",
        });
    }

    // Check if all required fields are provided (password not required for trainers)
    if (!name || !firstname || !lastname || !email) {
      return res
        .status(400)
        .json({ message: "Please provide all required fields" });
    }

    // For students, password is required
    if (role === "student" && !password) {
      return res
        .status(400)
        .json({ message: "Password is required for student registration" });
    }

    // Additional validation for trainer role
    if (role === "trainer") {
      if (!req.file) {
        return res
          .status(400)
          .json({
            message: "Resume file is required for trainer registration",
          });
      }

      if (!demoVideoUrl || !expertise || experience === undefined || !bio) {
        return res.status(400).json({
          message:
            "Trainers must provide demo video URL, expertise areas, experience years, and bio",
        });
      }

      // Parse expertise if it's a string (from form data)
      let expertiseArray;
      try {
        expertiseArray =
          typeof expertise === "string" ? JSON.parse(expertise) : expertise;
      } catch (e) {
        return res.status(400).json({ message: "Invalid expertise format" });
      }

      if (!Array.isArray(expertiseArray) || expertiseArray.length === 0) {
        return res
          .status(400)
          .json({ message: "Please provide at least one area of expertise" });
      }

      const experienceNum = parseInt(experience);
      if (isNaN(experienceNum) || experienceNum < 0 || experienceNum > 50) {
        return res
          .status(400)
          .json({
            message: "Experience must be a number between 0 and 50 years",
          });
      }

      if (bio.length > 500) {
        return res
          .status(400)
          .json({ message: "Bio cannot exceed 500 characters" });
      }
    }

    // Check if user already exists
    let user = await User.findOne({ email });
    if (user) {
      return res
        .status(400)
        .json({ message: "User already exists with this email" });
    }

    // Create user data object
    const userData = {
      name,
      firstname,
      lastname,
      email,
      role: role || "student",
    };

    // Add password for students only
    if (role === "student") {
      userData.password = password;
    }

    // Add trainer-specific fields if role is trainer
    if (role === "trainer") {
      // Store relative path for web access (e.g., /uploads/resumes/filename.pdf)
      userData.resume = `/uploads/resumes/${req.file.filename}`;
      userData.demoVideoUrl = demoVideoUrl;
      userData.expertise =
        typeof expertise === "string" ? JSON.parse(expertise) : expertise;
      userData.experience = parseInt(experience);
      userData.bio = bio;
      userData.status = "pending";
    }

    // Create new user
    user = new User(userData);

    // Save user to database (password will be hashed by pre-save hook for students)
    await user.save();

    // Give joining bonus to all new users
    if (JOINING_BONUS > 0) {
      user.walletBalance = JOINING_BONUS;
      user.totalEarned = JOINING_BONUS;
      await user.save();

      // Create transaction record for joining bonus
      const bonusTransaction = new Transaction({
        user: user._id,
        type: 'credit',
        amount: JOINING_BONUS,
        realMoneyAmount: 0,
        currency: 'INR',
        description: `Welcome bonus - ${JOINING_BONUS} UpCoins`,
        category: 'joining_bonus',
        status: 'completed',
        paymentMethod: 'wallet',
        reference: `joining_bonus_${user._id}`,
        balanceBefore: 0,
        balanceAfter: JOINING_BONUS,
        metadata: {
          bonusType: 'registration',
          userId: user._id
        }
      });
      await bonusTransaction.save();
      
      console.log(`Joining bonus of ${JOINING_BONUS} UpCoins credited to user: ${user.email}`);
    }

    // For students, generate JWT token and return login response
    if (role === "student") {
      const token = generateToken(user.id);

      const userResponse = {
        id: user.id,
        name: user.name,
        firstname: user.firstname,
        lastname: user.lastname,
        email: user.email,
        role: user.role,
        walletBalance: user.walletBalance,
        totalEarned: user.totalEarned,
        createdAt: user.createdAt,
        isApproved: user.isApproved,
        status: user.status,
      };

      return res.status(201).json({
        token,
        user: userResponse,
        message: `Account created successfully! You received ${JOINING_BONUS} UpCoins as a welcome bonus!`,
      });
    }

    // For trainers, return success message without token (they can't login until approved)
    if (role === "trainer") {
      return res.status(201).json({
        message:
          "Your trainer application has been submitted successfully! You will receive an email once your application is reviewed. Please check your email for updates.",
        status: "pending",
        email: user.email,
      });
    }
  } catch (err) {
    console.error("Error in register route:", err.message);

    // Handle validation errors
    if (err.name === "ValidationError") {
      const errors = Object.values(err.errors).map((error) => error.message);
      return res.status(400).json({
        message: "Validation failed",
        errors: errors,
      });
    }

    // Handle duplicate key error (email already exists)
    if (err.code === 11000) {
      return res.status(400).json({
        message: "User already exists with this email",
      });
    }

    res.status(500).json({ message: "Server error" });
  }
});

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user & get token
 * @access  Public
 */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if email and password are provided
    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Please provide email and password" });
    }

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Check if password is correct
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Generate JWT token
    const token = generateToken(user.id);

    // Check if trainer is approved
    if (user.role === "trainer" && !user.isApproved) {
      return res.status(403).json({
        message:
          "Your trainer account is still pending approval. Please wait for admin approval.",
        status: user.status,
      });
    }

    // Prepare user response data
    const userResponse = {
      id: user.id,
      name: user.name,
      firstname: user.firstname,
      lastname: user.lastname,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      isApproved: user.isApproved,
      status: user.status,
    };

    // Add trainer-specific fields to response if user is a trainer
    if (user.role === "trainer") {
      userResponse.resume = user.resume;
      userResponse.demoVideoUrl = user.demoVideoUrl;
      userResponse.expertise = user.expertise;
      userResponse.experience = user.experience;
      userResponse.bio = user.bio;
    }

    // Return token and user data
    res.json({
      token,
      user: userResponse,
    });
  } catch (err) {
    console.error("Error in login route:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * @route   GET /api/auth/me
 * @desc    Get current user
 * @access  Private
 */
router.get("/me", auth, async (req, res) => {
  try {
    // Get user data from database (excluding password)
    const user = await User.findById(req.user.id).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user);
  } catch (err) {
    console.error("Error in get user route:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * @route   GET /api/auth/users
 * @desc    Get all users
 * @access  Private (Admin only)
 */
router.get("/users", auth, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.id);
    if (currentUser.role !== "admin") {
      return res.status(403).json({ message: "Access denied. Admin only." });
    }

    const users = await User.find().select("-password");
    res.json(users);
  } catch (err) {
    console.error("Error fetching users:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * @route   GET /api/auth/users/stats
 * @desc    Get user statistics
 * @access  Private (Admin only)
 */
router.get("/users/stats", auth, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.id);
    if (currentUser.role !== "admin") {
      return res.status(403).json({ message: "Access denied. Admin only." });
    }

    const [
      totalUsers,
      students,
      trainers,
      admins,
      activeUsers,
      pendingUsers,
      suspendedUsers,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: "student" }),
      User.countDocuments({ role: "trainer" }),
      User.countDocuments({ role: "admin" }),
      User.countDocuments({ status: "approved" }),
      User.countDocuments({ status: "pending" }),
      User.countDocuments({ status: { $in: ["rejected", "suspended"] } }),
    ]);

    res.json({
      total: totalUsers,
      students,
      trainers,
      admins,
      active: activeUsers,
      pending: pendingUsers,
      suspended: suspendedUsers,
    });
  } catch (err) {
    console.error("Error fetching user stats:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * @route   GET /api/auth/users/search
 * @desc    Search users by name
 * @access  Private
 */
router.get("/users/search", auth, async (req, res) => {
  try {
    const { name } = req.query;
    if (!name) {
      return res
        .status(400)
        .json({ message: "Please provide a name to search" });
    }

    const users = await User.find({
      name: { $regex: name, $options: "i" },
    }).select("-password");

    res.json(users);
  } catch (err) {
    console.error("Error searching users:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * @route   GET /api/auth/trainers/pending
 * @desc    Get all pending trainer applications
 * @access  Private (Admin only)
 */
router.get("/trainers/pending", auth, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.id);
    if (currentUser.role !== "admin") {
      return res.status(403).json({ message: "Access denied. Admin only." });
    }

    const pendingTrainers = await User.find({
      role: "trainer",
      status: "pending",
    }).select("-password -tempPassword");

    res.json(pendingTrainers);
  } catch (err) {
    console.error("Error fetching pending trainers:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * @route   POST /api/auth/trainers/:id/approve
 * @desc    Approve a trainer application
 * @access  Private (Admin only)
 */
router.post("/trainers/:id/approve", auth, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.id);
    if (currentUser.role !== "admin") {
      return res.status(403).json({ message: "Access denied. Admin only." });
    }

    const trainer = await User.findById(req.params.id);
    if (!trainer) {
      return res.status(404).json({ message: "Trainer not found" });
    }

    if (trainer.role !== "trainer") {
      return res.status(400).json({ message: "User is not a trainer" });
    }

    if (trainer.status !== "pending") {
      return res
        .status(400)
        .json({ message: "Trainer application is not pending" });
    }

    // Generate temporary password
    const tempPassword = generateTempPassword();

    // Update trainer status and set password
    trainer.status = "approved";
    trainer.isApproved = true;
    trainer.password = tempPassword; // This will be hashed by the pre-save hook
    trainer.tempPassword = tempPassword; // Store unhashed for email

    await trainer.save();

    // Send approval email
    const emailTemplate = emailTemplates.trainerApproval(
      trainer.name,
      trainer.email,
      tempPassword
    );

    const emailResult = await sendEmail(trainer.email, emailTemplate);

    if (!emailResult.success) {
      console.error("Failed to send approval email:", emailResult.error);
      // Don't fail the approval process if email fails
    }

    res.json({
      message: "Trainer approved successfully",
      trainer: {
        id: trainer.id,
        name: trainer.name,
        email: trainer.email,
        status: trainer.status,
        isApproved: trainer.isApproved,
      },
      emailSent: emailResult.success,
    });
  } catch (err) {
    console.error("Error approving trainer:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * @route   POST /api/auth/trainers/:id/reject
 * @desc    Reject a trainer application
 * @access  Private (Admin only)
 */
router.post("/trainers/:id/reject", auth, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.id);
    if (currentUser.role !== "admin") {
      return res.status(403).json({ message: "Access denied. Admin only." });
    }

    const { reason } = req.body;
    const trainer = await User.findById(req.params.id);

    if (!trainer) {
      return res.status(404).json({ message: "Trainer not found" });
    }

    if (trainer.role !== "trainer") {
      return res.status(400).json({ message: "User is not a trainer" });
    }

    if (trainer.status !== "pending") {
      return res
        .status(400)
        .json({ message: "Trainer application is not pending" });
    }

    // Update trainer status
    trainer.status = "rejected";
    trainer.isApproved = false;
    await trainer.save();

    // Send rejection email
    const emailTemplate = emailTemplates.trainerRejection(
      trainer.name,
      trainer.email,
      reason
    );

    const emailResult = await sendEmail(trainer.email, emailTemplate);

    if (!emailResult.success) {
      console.error("Failed to send rejection email:", emailResult.error);
    }

    res.json({
      message: "Trainer application rejected",
      trainer: {
        id: trainer.id,
        name: trainer.name,
        email: trainer.email,
        status: trainer.status,
        isApproved: trainer.isApproved,
      },
      emailSent: emailResult.success,
    });
  } catch (err) {
    console.error("Error rejecting trainer:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * @route   PUT /api/auth/users/:id/status
 * @desc    Update user status (suspend/activate)
 * @access  Private (Admin only)
 */
router.put("/users/:id/status", auth, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.id);
    if (currentUser.role !== "admin") {
      return res.status(403).json({ message: "Access denied. Admin only." });
    }

    const { status } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!["approved", "suspended", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    // Update user status
    user.status = status;
    user.isApproved = status === "approved";
    await user.save();

    res.json({
      message: `User ${status} successfully`,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        status: user.status,
        isApproved: user.isApproved,
      },
    });
  } catch (err) {
    console.error("Error updating user status:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * @route   GET /api/auth/users/filter
 * @desc    Get filtered users
 * @access  Private (Admin only)
 */
router.get("/users/filter", auth, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.id);
    if (currentUser.role !== "admin") {
      return res.status(403).json({ message: "Access denied. Admin only." });
    }

    const { role, status, search } = req.query;
    let query = {};

    // Build filter query
    if (role && role !== "all") {
      query.role = role;
    }

    if (status && status !== "all") {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { firstname: { $regex: search, $options: "i" } },
        { lastname: { $regex: search, $options: "i" } },
      ];
    }

    const users = await User.find(query)
      .select("-password -tempPassword")
      .sort({ createdAt: -1 })
      .limit(100); // Limit results for performance

    res.json(users);
  } catch (err) {
    console.error("Error filtering users:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Request password reset email
 * @access  Public
 */
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });

    // Always return success message for security (don't reveal if email exists)
    if (!user) {
      return res.json({
        success: true,
        message: "If an account exists with this email, you will receive a password reset link.",
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenHash = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    // Save hashed token and expiry to user (1 hour expiry)
    user.resetPasswordToken = resetTokenHash;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    // Create reset URL
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:8080'}/reset-password/${resetToken}`;

    // Send email
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px 8px 0 0;">
          <h2 style="color: #333; margin: 0;">Password Reset Request</h2>
        </div>
        <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e0e0e0;">
          <p style="color: #333; line-height: 1.6;">Hello ${user.name},</p>
          <p style="color: #333; line-height: 1.6;">
            You requested to reset your password for your UpScholar account. Click the button below to reset your password:
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" 
               style="background-color: #4F46E5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
              Reset Password
            </a>
          </div>
          <p style="color: #666; line-height: 1.6; font-size: 14px;">
            Or copy and paste this link into your browser:
          </p>
          <p style="color: #4F46E5; word-break: break-all; font-size: 14px;">
            ${resetUrl}
          </p>
          <p style="color: #666; line-height: 1.6; font-size: 14px; margin-top: 30px;">
            <strong>This link will expire in 1 hour.</strong>
          </p>
          <p style="color: #666; line-height: 1.6; font-size: 14px;">
            If you didn't request this password reset, please ignore this email and your password will remain unchanged.
          </p>
        </div>
        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 0 0 8px 8px; text-align: center;">
          <p style="color: #666; font-size: 12px; margin: 0;">
            This email was sent from UpScholar Learning Platform
          </p>
        </div>
      </div>
    `;

    // Send email using the email service
    try {
      const emailResult = await sendEmail(user.email, {
        subject: "Password Reset Request - UpScholar",
        html: emailHtml,
      });
      
      console.log('Password reset email sent:', emailResult);
    } catch (emailError) {
      console.error('Error sending password reset email:', emailError);
      // Don't fail the request if email fails, but log it
    }

    res.json({
      success: true,
      message: "If an account exists with this email, you will receive a password reset link.",
    });
  } catch (err) {
    console.error("Error in forgot password:", err.message);
    res.status(500).json({ message: "Error sending reset email. Please try again." });
  }
});

/**
 * @route   POST /api/auth/reset-password/:token
 * @desc    Reset password with token
 * @access  Public
 */
router.post("/reset-password/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ message: "Password is required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters long" });
    }

    // Hash the token from URL to compare with stored hash
    const resetTokenHash = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    // Find user with valid reset token
    const user = await User.findOne({
      resetPasswordToken: resetTokenHash,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      console.log('Reset token not found or expired');
      return res.status(400).json({ 
        message: "Password reset token is invalid or has expired" 
      });
    }

    console.log('User found for password reset:', user.email);

    // Set new password (will be hashed by pre-save hook)
    user.password = password;

    // Clear reset token fields
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();
    
    console.log('Password reset successful for:', user.email);

    // Send confirmation email
    const confirmationHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px 8px 0 0;">
          <h2 style="color: #333; margin: 0;">Password Changed Successfully</h2>
        </div>
        <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e0e0e0;">
          <p style="color: #333; line-height: 1.6;">Hello ${user.name},</p>
          <p style="color: #333; line-height: 1.6;">
            Your password has been successfully changed. You can now log in with your new password.
          </p>
          <p style="color: #666; line-height: 1.6; font-size: 14px; margin-top: 30px;">
            If you didn't make this change, please contact our support team immediately.
          </p>
        </div>
        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 0 0 8px 8px; text-align: center;">
          <p style="color: #666; font-size: 12px; margin: 0;">
            This email was sent from UpScholar Learning Platform
          </p>
        </div>
      </div>
    `;

    // Send confirmation email
    try {
      await sendEmail(user.email, {
        subject: "Password Changed - UpScholar",
        html: confirmationHtml,
      });
      console.log('Password change confirmation email sent');
    } catch (emailError) {
      console.error('Error sending confirmation email:', emailError);
      // Don't fail the request if email fails
    }

    res.json({
      success: true,
      message: "Password has been reset successfully. You can now log in with your new password.",
    });
  } catch (err) {
    console.error("Error in reset password:", err.message);
    res.status(500).json({ message: "Error resetting password. Please try again." });
  }
});

/**
 * @route   POST /api/auth/change-password
 * @desc    Change password for logged-in user
 * @access  Private
 */
router.post("/change-password", auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Current password and new password are required" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: "New password must be at least 6 characters long" });
    }

    // Find user
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    // Set new password (will be hashed by pre-save hook)
    user.password = newPassword;
    await user.save();

    console.log('Password changed successfully for:', user.email);

    // Send confirmation email
    const confirmationHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px 8px 0 0;">
          <h2 style="color: #333; margin: 0;">Password Changed Successfully</h2>
        </div>
        <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e0e0e0;">
          <p style="color: #333; line-height: 1.6;">Hello ${user.name},</p>
          <p style="color: #333; line-height: 1.6;">
            Your password has been successfully changed.
          </p>
          <p style="color: #666; line-height: 1.6; font-size: 14px; margin-top: 30px;">
            If you didn't make this change, please contact our support team immediately.
          </p>
        </div>
        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 0 0 8px 8px; text-align: center;">
          <p style="color: #666; font-size: 12px; margin: 0;">
            This email was sent from UpScholar Learning Platform
          </p>
        </div>
      </div>
    `;

    // Send confirmation email
    try {
      await sendEmail(user.email, {
        subject: "Password Changed - UpScholar",
        html: confirmationHtml,
      });
      console.log('Password change confirmation email sent');
    } catch (emailError) {
      console.error('Error sending confirmation email:', emailError);
    }

    res.json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (err) {
    console.error("Error changing password:", err.message);
    res.status(500).json({ message: "Error changing password. Please try again." });
  }
});

module.exports = router;
