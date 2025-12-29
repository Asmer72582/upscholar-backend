const Razorpay = require('razorpay');
require('dotenv').config();

// Initialize Razorpay instance with UPI enabled
const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Joining bonus configuration
const JOINING_BONUS = 1000; // UpCoins given to new students on signup

// Course creation cost
const COURSE_CREATION_COST = 50; // UpCoins required to create a course/lecture

// Platform fee percentage (taken from student payments to trainers)
const PLATFORM_FEE_PERCENTAGE = 10; // 10% platform fee

// UpCoin packages configuration with bonus coins for larger purchases
const UPCOIN_PACKAGES = [
  {
    id: 'package_100',
    upcoins: 100,
    bonusCoins: 0,
    totalCoins: 100,
    price: 100, // in INR (₹100)
    discount: 0,
    popular: false,
    description: 'Starter Pack',
    savings: 0,
    badge: null
  },
  {
    id: 'package_250',
    upcoins: 250,
    bonusCoins: 25, // 10% bonus
    totalCoins: 275,
    price: 250, // in INR (₹250)
    discount: 10,
    popular: false,
    description: 'Basic Pack',
    savings: 25,
    badge: '+10% Bonus'
  },
  {
    id: 'package_500',
    upcoins: 500,
    bonusCoins: 75, // 15% bonus
    totalCoins: 575,
    price: 500, // in INR (₹500)
    discount: 15,
    popular: true,
    description: 'Popular Pack',
    savings: 75,
    badge: '+15% Bonus'
  },
  {
    id: 'package_1000',
    upcoins: 1000,
    bonusCoins: 200, // 20% bonus
    totalCoins: 1200,
    price: 1000, // in INR (₹1000)
    discount: 20,
    popular: false,
    description: 'Premium Pack',
    savings: 200,
    badge: '+20% Bonus'
  },
  {
    id: 'package_2500',
    upcoins: 2500,
    bonusCoins: 750, // 30% bonus
    totalCoins: 3250,
    price: 2500, // in INR (₹2500)
    discount: 30,
    popular: false,
    description: 'Ultimate Pack',
    savings: 750,
    badge: 'Best Value'
  }
];

module.exports = {
  razorpayInstance,
  UPCOIN_PACKAGES,
  JOINING_BONUS,
  COURSE_CREATION_COST,
  PLATFORM_FEE_PERCENTAGE
};
