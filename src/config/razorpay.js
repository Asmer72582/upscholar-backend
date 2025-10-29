const Razorpay = require('razorpay');
require('dotenv').config();

// Initialize Razorpay instance with UPI enabled
const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Joining bonus configuration
const JOINING_BONUS = 150; // UpCoins given to new users

// Course creation cost
const COURSE_CREATION_COST = 50; // UpCoins required to create a course/lecture

// Platform fee percentage (taken from student payments to trainers)
const PLATFORM_FEE_PERCENTAGE = 10; // 10% platform fee

// UpCoin packages configuration
const UPCOIN_PACKAGES = [
  {
    id: 'package_100',
    upcoins: 100,
    price: 100, // in INR (₹100)
    discount: 0,
    popular: false,
    description: 'Starter Pack'
  },
  {
    id: 'package_250',
    upcoins: 250,
    price: 250, // in INR (₹250)
    discount: 0,
    popular: false,
    description: 'Basic Pack'
  },
  {
    id: 'package_500',
    upcoins: 500,
    price: 500, // in INR (₹500)
    discount: 0,
    popular: true,
    description: 'Popular Pack'
  },
  {
    id: 'package_1000',
    upcoins: 1000,
    price: 1000, // in INR (₹1000)
    discount: 0,
    popular: false,
    description: 'Premium Pack'
  }
];

module.exports = {
  razorpayInstance,
  UPCOIN_PACKAGES,
  JOINING_BONUS,
  COURSE_CREATION_COST,
  PLATFORM_FEE_PERCENTAGE
};
