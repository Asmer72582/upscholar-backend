const axios = require('axios');

async function testPasswordChange() {
    try {
        // First, login to get the token
        console.log('Logging in as trainer...');
        const loginResponse = await axios.post('http://13.60.254.183:3000/api/auth/login', {
            email: 'trainer@upscholer.com',
            password: 'trainer123456'
        });

        const token = loginResponse.data.token;
        console.log('Login successful, token received');

        // Now test password change
        console.log('Testing password change...');
        const changePasswordResponse = await axios.put('http://13.60.254.183:3000/api/trainer/change-password', {
            currentPassword: 'trainer123456',
            newPassword: 'newpassword123'
        }, {
            headers: {
                'x-auth-token': token
            }
        });

        console.log('Password change response:', changePasswordResponse.data);

        // Test login with new password
        console.log('Testing login with new password...');
        const newLoginResponse = await axios.post('http://13.60.254.183:3000/api/auth/login', {
            email: 'trainer@upscholer.com',
            password: 'newpassword123'
        });

        console.log('Login with new password successful!');

        // Change password back to original
        console.log('Changing password back to original...');
        await axios.put('http://13.60.254.183:3000/api/trainer/change-password', {
            currentPassword: 'newpassword123',
            newPassword: 'trainer123456'
        }, {
            headers: {
                'x-auth-token': newLoginResponse.data.token
            }
        });

        console.log('Password change functionality is working correctly!');

    } catch (error) {
        console.error('Error:', error.response ? error.response.data : error.message);
    }
}

testPasswordChange();