// This is a simple test script to manually test the authentication endpoints
// You can run this with Node.js to test the API endpoints

require('dotenv').config();
const axios = require('axios');

// API base URL from environment variable
const API_URL = process.env.API_URL || 'http://13.60.254.183:3000/api';

// Test user data
const testUser = {
  name: 'Test User',
  firstname: 'Test',
  lastname: 'User',
  email: 'testuser@example.com',
  password: 'password123'
};

// Store the JWT token
let token = '';

// Test registration endpoint
async function testRegister() {
  try {
    console.log('Testing registration endpoint...');
    const response = await axios.post(`${API_URL}/auth/register`, testUser);
    console.log('Registration successful!');
    console.log('Response:', response.data);
    token = response.data.token;
    return response.data;
  } catch (error) {
    console.error('Registration failed:', error.response ? error.response.data : error.message);
  }
}

// Test login endpoint
async function testLogin() {
  try {
    console.log('\nTesting login endpoint...');
    const response = await axios.post(`${API_URL}/auth/login`, {
      email: testUser.email,
      password: testUser.password
    });
    console.log('Login successful!');
    console.log('Response:', response.data);
    token = response.data.token;
    return response.data;
  } catch (error) {
    console.error('Login failed:', error.response ? error.response.data : error.message);
  }
}

// Test get current user endpoint
async function testGetMe() {
  try {
    console.log('\nTesting get current user endpoint...');
    const response = await axios.get(`${API_URL}/auth/me`, {
      headers: {
        'x-auth-token': token
      }
    });
    console.log('Get current user successful!');
    console.log('Response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Get current user failed:', error.response ? error.response.data : error.message);
  }
}

// Run all tests
async function runTests() {
  try {
    // First try to login (in case user already exists)
    await testLogin();
  } catch (error) {
    // If login fails, try to register
    await testRegister();
  }
  
  // Then test login
  await testLogin();
  
  // Finally test get current user
  await testGetMe();
}

// Run the tests
runTests();

/*
 To run this test script:
 1. Make sure the server is running
 2. Install axios if not already installed: npm install axios
 3. Run: node src/tests/auth.test.js
*/