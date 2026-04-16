const argon2 = require('argon2');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../config/database');
const { setCsrfTokenCookie } = require('../middleware/authMiddleware_new');

// Login endpoint for affiliates
const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Find affiliate by username
    const affiliateResult = await db.query(
      'SELECT id, username, password_hash, status FROM affiliates WHERE username = $1',
      [username]
    );

    if (affiliateResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const affiliate = affiliateResult.rows[0];

    // Check if suspended
    if (affiliate.status === 'suspended') {
      return res.status(403).json({ error: 'Account suspended' });
    }

    // Verify password
    const isValid = await argon2.verify(affiliate.password_hash, password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT tokens
    const accessToken = jwt.sign({ affiliateId: affiliate.id, type: 'affiliate' }, process.env.JWT_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign({ affiliateId: affiliate.id, type: 'affiliate' }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '7d' });

    // Set cookies
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    // Set CSRF token
    setCsrfTokenCookie(res, affiliate.id);

    res.json({
      success: true,
      data: {
        username: affiliate.username,
        message: 'Affiliate login successful',
        token: accessToken
      }
    });
  } catch (error) {
    console.error('Affiliate login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Logout endpoint
const logout = async (req, res) => {
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
  res.clearCookie('csrfToken');
  res.json({ success: true, message: 'Logged out successfully' });
};

// Forgot password - validate recovery code
const validateRecoveryCode = async (req, res) => {
  try {
    const { username, recoveryCode } = req.body;

    if (!username || !recoveryCode) {
      return res.status(400).json({ error: 'Username and recovery code required' });
    }

    // Find affiliate
    const affiliateResult = await db.query(
      'SELECT id, username, recovery_codes_hash FROM affiliates WHERE username = $1 AND status = $2',
      [username, 'active']
    );

    if (affiliateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Affiliate not found' });
    }

    const affiliate = affiliateResult.rows[0];

    // Parse and check recovery codes
    let recoveryCodes = [];
    try {
      recoveryCodes = JSON.parse(affiliate.recovery_codes_hash || '[]');
    } catch (e) {
      recoveryCodes = [];
    }

    if (recoveryCodes.length === 0) {
      return res.status(400).json({ error: 'No recovery codes available. Contact William.' });
    }

    // Find matching code — must use for loop (findIndex async returns Promise, always truthy)
    let codeIndex = -1;
    for (let i = 0; i < recoveryCodes.length; i++) {
      try {
        const isMatch = await argon2.verify(recoveryCodes[i], recoveryCode.toUpperCase().trim());
        if (isMatch) { codeIndex = i; break; }
      } catch { /* continue */ }
    }

    if (codeIndex === -1) {
      return res.status(401).json({ error: 'Invalid recovery code' });
    }

    // Remove used code
    recoveryCodes.splice(codeIndex, 1);

    // Update affiliate with remaining codes
    await db.query(
      'UPDATE affiliates SET recovery_codes_hash = $1 WHERE id = $2',
      [JSON.stringify(recoveryCodes), affiliate.id]
    );

    // Generate a temp token for password reset
    const resetToken = jwt.sign({ affiliateId: affiliate.id, purpose: 'reset' }, process.env.JWT_SECRET, { expiresIn: '30m' });

    res.json({
      success: true,
      data: { resetToken },
      message: 'Recovery code valid. Set your new password.'
    });
  } catch (error) {
    console.error('Validate recovery code error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Reset password with recovery code
const resetPassword = async (req, res) => {
  try {
    const { newPassword, confirmPassword } = req.body;

    if (!newPassword || !confirmPassword) {
      return res.status(400).json({ error: 'New password and confirmation required' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Verify token was just issued for reset
    if (!req.user || req.user.purpose !== 'reset') {
      return res.status(401).json({ error: 'Invalid or expired reset session' });
    }

    // Hash new password
    const newPasswordHash = await argon2.hash(newPassword);

    // Update password
    await db.query(
      'UPDATE affiliates SET password_hash = $1 WHERE id = $2',
      [newPasswordHash, req.user.affiliateId]
    );

    res.json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Generate recovery kit (for admin or affiliate to regenerate)
const generateRecoveryKit = async (req, res) => {
  try {
    const { affiliateId, password } = req.body;

    // Verify password if provided (affiliate regenerating own kit)
    if (req.affiliateId) {
      // Affiliate regenerating their own kit
      const affiliateResult = await db.query(
        'SELECT password_hash FROM affiliates WHERE id = $1',
        [req.affiliateId]
      );

      if (affiliateResult.rows.length === 0) {
        return res.status(404).json({ error: 'Affiliate not found' });
      }

      const isValid = await argon2.verify(affiliateResult.rows[0].password_hash, password);
      if (!isValid) {
        return res.status(401).json({ error: 'Invalid password' });
      }

      // Generate 10 recovery codes
      const codes = [];
      for (let i = 0; i < 10; i++) {
        codes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
      }

      // Hash codes for storage
      const hashedCodes = await Promise.all(codes.map(async (code) => {
        return await argon2.hash(code);
      }));

      await db.query(
        'UPDATE affiliates SET recovery_codes_hash = $1 WHERE id = $2',
        [JSON.stringify(hashedCodes), req.affiliateId]
      );

      res.json({
        success: true,
        data: { recoveryCodes: codes },
        message: 'Recovery kit generated. Save these codes securely.'
      });
    } else if (req.user?.role && affiliateId) {
      // Admin creating kit for affiliate
      const codes = [];
      for (let i = 0; i < 10; i++) {
        codes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
      }

      const hashedCodes = await Promise.all(codes.map(async (code) => {
        return await argon2.hash(code);
      }));

      await db.query(
        'UPDATE affiliates SET recovery_codes_hash = $1 WHERE id = $2',
        [JSON.stringify(hashedCodes), affiliateId]
      );

      res.json({
        success: true,
        data: { recoveryCodes: codes },
        message: 'Recovery kit generated for affiliate.'
      });
    } else {
      return res.status(400).json({ error: 'Invalid request' });
    }
  } catch (error) {
    console.error('Generate recovery kit error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get affiliate profile
const getProfile = async (req, res) => {
  try {
    const affiliateResult = await db.query(
      'SELECT id, username, status, created_at FROM affiliates WHERE id = $1',
      [req.affiliateId]
    );

    if (affiliateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Affiliate not found' });
    }

    res.json({
      success: true,
      data: affiliateResult.rows[0]
    });
  } catch (error) {
    console.error('Get affiliate profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Change password (logged in)
const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword, confirmPassword } = req.body;

    if (!oldPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ error: 'All password fields required' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'New passwords do not match' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Get current hash
    const affiliateResult = await db.query(
      'SELECT password_hash FROM affiliates WHERE id = $1',
      [req.affiliateId]
    );

    if (affiliateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Affiliate not found' });
    }

    // Verify old password
    const isValid = await argon2.verify(affiliateResult.rows[0].password_hash, oldPassword);
    if (!isValid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash and save new password
    const newPasswordHash = await argon2.hash(newPassword);
    await db.query(
      'UPDATE affiliates SET password_hash = $1 WHERE id = $2',
      [newPasswordHash, req.affiliateId]
    );

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  login,
  logout,
  validateRecoveryCode,
  resetPassword,
  generateRecoveryKit,
  getProfile,
  changePassword
};
