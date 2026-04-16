const speakeasy = require('speakeasy');
const qrcode = require('qrcode');

/**
 * Generate a new TOTP secret for a user
 * @param {string} issuer - Your app name (e.g., AhoyVPN)
 * @param {string} accountName - User's email or identifier
 * @returns {Object} { secret, otpauthUrl }
 */
const generateSecret = (issuer, accountName) => {
  const secret = speakeasy.generateSecret({
    length: 20,
    name: `${issuer}:${accountName}`,
    issuer,
  });
  return {
    secret: secret.base32,
    otpauthUrl: secret.otpauth_url,
  };
};

/**
 * Generate QR code data URL for the otpauth URL
 * @param {string} otpauthUrl
 * @returns {Promise<string>} Data URL of QR code image
 */
const generateQRCode = async (otpauthUrl) => {
  return await qrcode.toDataURL(otpauthUrl);
};

/**
 * Verify a TOTP token against a secret
 * @param {string} secret - Base32 secret
 * @param {string} token - 6-digit token from authenticator app
 * @param {number} window - Allowable drift in steps (default 1)
 * @returns {boolean}
 */
const verifyToken = (secret, token, window = 1) => {
  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token,
    window,
  });
};

/**
 * Generate recovery codes (one-time use)
 * @param {number} count - Number of codes to generate (default 10)
 * @returns {string[]} Array of codes (each 10 characters, dash-separated)
 */
const generateRecoveryCodes = (count = 10) => {
  const codes = [];
  for (let i = 0; i < count; i++) {
    // Generate 10 random alphanumeric characters, split into groups for readability
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let j = 0; j < 10; j++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    // Insert dash after 5 characters for readability: XXXXX-XXXXX
    code = code.slice(0, 5) + '-' + code.slice(5);
    codes.push(code);
  }
  return codes;
};

module.exports = {
  generateSecret,
  generateQRCode,
  verifyToken,
  generateRecoveryCodes,
};