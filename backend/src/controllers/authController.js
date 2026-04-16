const User = require('../models/userModel');
const { generateToken, generateRefreshToken, verifyToken, verifyRefreshToken } = require('../utils/jwt');
const { generateSecret, generateQRCode, verifyToken: verifyTotpToken, generateRecoveryCodes: generateRecoveryCodesUtil } = require('../utils/totp');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const db = require('../config/database');
const { generateCsrfToken, storeCsrfToken } = require('../middleware/authMiddleware_new');
const { validatePasswordComplexity } = require('../middleware/passwordValidation');

// Helper to generate temporary token for 2FA verification during login
const generate2faTempToken = (userId) => {
  return crypto.randomBytes(32).toString('hex');
};

// Store temporary tokens in memory (in production use Redis)
const temp2faTokens = new Map();

// Hash token
const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

// Set CSRF token cookie (non-HTTP-only, readable by JavaScript)
const setCsrfTokenCookie = (res, userId) => {
  const csrfToken = generateCsrfToken();
  storeCsrfToken(userId, csrfToken);
  
  res.cookie('csrfToken', csrfToken, {
    httpOnly: false, // JavaScript can read this
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 15 * 60 * 1000, // 15 minutes (matches access token)
  });
  
  return csrfToken;
};

const register = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }
    
    // Set trial ends at 7 days from now
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 7);
    
    const user = await User.create({ email, password, trialEndsAt });
    
    // Generate tokens
    const accessToken = generateToken({ userId: user.id });
    const refreshToken = generateRefreshToken({ userId: user.id });
    
    // TODO: Store refresh token in database (optional)
    
    // Set HTTP‑only cookies
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000, // 15 minutes (matches JWT_EXPIRES_IN)
    });
    
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
    
    // Set CSRF token cookie (non-HTTP-only)
    setCsrfTokenCookie(res, user.id);
    
    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          trialEndsAt: user.trial_ends_at,
        },
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const isPasswordValid = await User.verifyPassword(user.id, password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Check if 2FA is enabled
    if (user.totp_enabled) {
      // Generate a temporary token for 2FA verification
      const tempToken = generate2faTempToken(user.id);
      temp2faTokens.set(tempToken, { userId: user.id, createdAt: Date.now() });
      
      // Expire after 5 minutes
      setTimeout(() => {
        temp2faTokens.delete(tempToken);
      }, 5 * 60 * 1000);
      
      return res.status(200).json({
        success: true,
        requires2fa: true,
        tempToken,
        message: 'Two-factor authentication required',
      });
    }
    
    // Update last login
    await User.update(user.id, { last_login: new Date() });
    
    const accessToken = generateToken({ userId: user.id });
    const refreshToken = generateRefreshToken({ userId: user.id });
    
    // Set HTTP‑only cookies
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000, // 15 minutes (matches JWT_EXPIRES_IN)
    });
    
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
    
    // Set CSRF token cookie (non-HTTP-only)
    setCsrfTokenCookie(res, user.id);
    
    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          trialEndsAt: user.trial_ends_at,
          totpEnabled: user.totp_enabled,
        },
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const logout = async (req, res) => {
  // Clear HTTP‑only cookies
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
  res.clearCookie('csrfToken');
  // Invalidate refresh token (if stored). For now, just client side removal.
  res.status(200).json({ success: true, message: 'Logged out' });
};

const refreshToken = async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token required' });
  }
  
  const decoded = verifyRefreshToken(refreshToken);
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid refresh token' });
  }
  
  // Optional: check if refresh token is blacklisted or revoked
  
  const user = await User.findById(decoded.userId);
  if (!user || !user.is_active) {
    return res.status(401).json({ error: 'User not found or inactive' });
  }
  
  const newAccessToken = generateToken({ userId: user.id });
  const newRefreshToken = generateRefreshToken({ userId: user.id });
  
  // Optionally revoke old refresh token
  
  res.status(200).json({
    success: true,
    data: {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    },
  });
};

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    // Find user by email
    const userResult = await db.query(
      'SELECT id, email FROM users WHERE email = $1',
      [email]
    );
    
    if (userResult.rows.length === 0) {
      // Don't reveal if email exists
      return res.json({
        success: true,
        message: 'If an account exists with this email, you will receive a password reset link shortly.'
      });
    }
    
    const user = userResult.rows[0];
    
    // Generate reset token
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(token);
    
    // Store token in database
    await db.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, created_at)
       VALUES ($1, $2, NOW() + INTERVAL '1 hour', NOW())`,
      [user.id, tokenHash]
    );
    
    // TODO: Send email with reset link
    // For now, just return success
    console.log(`Password reset token for ${email}: ${token}`);
    
    res.json({
      success: true,
      message: 'If an account exists with this email, you will receive a password reset link shortly.'
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { token, password, confirmPassword } = req.body;
    
    if (!token || !password || !confirmPassword) {
      return res.status(400).json({ error: 'Token, password, and confirm password are required' });
    }
    
    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }
    
    // Validate password complexity
    const validation = validatePasswordComplexity(password);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Password validation failed',
        message: validation.errors.join(', ')
      });
    }
    
    const tokenHash = hashToken(token);
    
    // Find valid, unused token
    const tokenResult = await db.query(
      `SELECT prt.*, u.id as user_id, u.email
       FROM password_reset_tokens prt
       JOIN users u ON prt.user_id = u.id
       WHERE prt.token_hash = $1 AND prt.used = false AND prt.expires_at > NOW()`,
      [tokenHash]
    );
    
    if (tokenResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }
    
    const tokenData = tokenResult.rows[0];
    
    // Hash the new password
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Update user password
    await db.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [passwordHash, tokenData.user_id]
    );
    
    // Mark token as used
    await db.query(
      'UPDATE password_reset_tokens SET used = true, used_at = NOW() WHERE token_hash = $1',
      [tokenHash]
    );
    
    res.json({
      success: true,
      message: 'Password reset successfully. You can now login with your new password.'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// 2FA Endpoints

const enable2FA = async (req, res) => {
  try {
    const user = req.user; // from protect middleware
    
    if (user.totp_enabled) {
      return res.status(400).json({ error: '2FA already enabled' });
    }
    
    // Generate a new secret
    const { secret, otpauthUrl } = generateSecret('AhoyVPN', user.email);
    
    // Store secret temporarily (not yet enabled)
    await User.setTotpSecret(user.id, secret);
    
    // Generate QR code
    const qrCodeDataUrl = await generateQRCode(otpauthUrl);
    
    res.status(200).json({
      success: true,
      data: {
        secret, // only for manual entry, consider hiding in production
        otpauthUrl,
        qrCodeDataUrl,
      },
    });
  } catch (error) {
    console.error('Enable 2FA error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const verify2FA = async (req, res) => {
  try {
    const user = req.user;
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }
    
    if (!user.totp_secret) {
      return res.status(400).json({ error: '2FA not set up. Please enable first.' });
    }
    
    const isValid = verifyTotpToken(user.totp_secret, token);
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid token' });
    }
    
    // Enable 2FA for this user
    await User.enableTotp(user.id);
    
    // Generate recovery codes
    const recoveryCodes = await User.generateAndStoreRecoveryCodes(user.id, 10);
    
    // Update last 2FA verification
    await User.updateLast2faVerification(user.id);
    
    res.status(200).json({
      success: true,
      data: {
        recoveryCodes, // show only once
        message: 'Two-factor authentication enabled successfully',
      },
    });
  } catch (error) {
    console.error('Verify 2FA error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const verify2FALogin = async (req, res) => {
  try {
    const { tempToken, token } = req.body;
    
    if (!tempToken || !token) {
      return res.status(400).json({ error: 'Temp token and token are required' });
    }
    
    const tempData = temp2faTokens.get(tempToken);
    if (!tempData) {
      return res.status(400).json({ error: 'Invalid or expired temporary token' });
    }
    
    // Remove temp token (single use)
    temp2faTokens.delete(tempToken);
    
    const user = await User.findById(tempData.userId);
    if (!user || !user.totp_enabled) {
      return res.status(400).json({ error: 'User not found or 2FA not enabled' });
    }
    
    const isValid = verifyTotpToken(user.totp_secret, token);
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid token' });
    }
    
    // Update last login and 2FA verification
    await User.update(user.id, { last_login: new Date() });
    await User.updateLast2faVerification(user.id);
    
    const accessToken = generateToken({ userId: user.id, twoFactorVerified: true });
    const refreshToken = generateRefreshToken({ userId: user.id });
    
    // Set HTTP‑only cookies
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000, // 15 minutes (matches JWT_EXPIRES_IN)
    });
    
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
    
    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          trialEndsAt: user.trial_ends_at,
        },
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    console.error('Verify 2FA login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const generateNewRecoveryCodes = async (req, res) => {
  try {
    const user = req.user;
    
    if (!user.totp_enabled) {
      return res.status(400).json({ error: '2FA is not enabled' });
    }
    
    const recoveryCodes = await User.generateAndStoreRecoveryCodes(user.id, 10);
    
    res.status(200).json({
      success: true,
      data: {
        recoveryCodes, // show only once
        message: 'New recovery codes generated. Save them securely.',
      },
    });
  } catch (error) {
    console.error('Generate recovery codes error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const verifyRecoveryCode = async (req, res) => {
  try {
    const { email, password, recoveryCode } = req.body;
    
    if (!email || !password || !recoveryCode) {
      return res.status(400).json({ error: 'Email, password, and recovery code are required' });
    }
    
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const isPasswordValid = await User.verifyPassword(user.id, password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    if (!user.totp_enabled) {
      return res.status(400).json({ error: '2FA is not enabled for this account' });
    }
    
    const isValid = await User.verifyAndConsumeRecoveryCode(user.id, recoveryCode);
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid recovery code' });
    }
    
    // Update last login and 2FA verification
    await User.update(user.id, { last_login: new Date() });
    await User.updateLast2faVerification(user.id);
    
    const accessToken = generateToken({ userId: user.id, twoFactorVerified: true });
    const refreshToken = generateRefreshToken({ userId: user.id });
    
    // Set HTTP‑only cookies
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000, // 15 minutes (matches JWT_EXPIRES_IN)
    });
    
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
    
    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          trialEndsAt: user.trial_ends_at,
        },
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    console.error('Verify recovery code error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const disable2FA = async (req, res) => {
  try {
    const user = req.user;
    const { password } = req.body; // require password for security
    
    if (!password) {
      return res.status(400).json({ error: 'Password is required to disable 2FA' });
    }
    
    const isPasswordValid = await User.verifyPassword(user.id, password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid password' });
    }
    
    await User.disableTotp(user.id);
    
    res.status(200).json({
      success: true,
      message: 'Two-factor authentication disabled successfully',
    });
  } catch (error) {
    console.error('Disable 2FA error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const verifyEmail = async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ error: 'Verification token is required' });
    }
    
    const tokenHash = hashToken(token);
    
    // Find token with user email
    const result = await db.query(
      `SELECT evt.*, u.id as user_id, u.email, u.email_verified
       FROM email_verify_tokens evt
       JOIN users u ON evt.user_id = u.id
       WHERE evt.token_hash = $1`,
      [tokenHash]
    );
    
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired verification token' });
    }
    
    const tokenData = result.rows[0];
    
    // Check if token is expired
    if (new Date(tokenData.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Verification token has expired' });
    }
    
    // Check if email is already verified
    if (tokenData.email_verified) {
      return res.status(400).json({ error: 'Email is already verified' });
    }
    
    // Verify the email
    await db.query(
      'UPDATE users SET email_verified = true, updated_at = NOW() WHERE id = $1',
      [tokenData.user_id]
    );
    
    // Delete the used token
    await db.query(
      'DELETE FROM email_verify_tokens WHERE token_hash = $1',
      [tokenHash]
    );
    
    res.json({
      success: true,
      message: 'Email verified successfully',
      email: tokenData.email
    });
  } catch (error) {
    console.error('Verify email error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  register,
  login,
  logout,
  refreshToken,
  forgotPassword,
  resetPassword,
  verifyEmail,
  enable2FA,
  verify2FA,
  verify2FALogin,
  generateNewRecoveryCodes,
  verifyRecoveryCode,
  disable2FA,
};