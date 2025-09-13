const crypto = require('crypto');

/**
 * Generate a secure temporary password
 * @param {number} length - Length of the password (default: 12)
 * @returns {string} - Generated password
 */
const generateTempPassword = (length = 12) => {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  
  for (let i = 0; i < length; i++) {
    const randomIndex = crypto.randomInt(0, charset.length);
    password += charset[randomIndex];
  }
  
  return password;
};

module.exports = {
  generateTempPassword
};