const User = require('../models/userModel');
const { generateToken, generateRefreshToken } = require('../utils/jwt');
const bcrypt = require('bcrypt');
const db = require('../config/database');
const { generateCsrfToken, storeCsrfToken } = require('../middleware/authMiddleware_new');
const { passwordValidationMiddleware, validatePasswordComplexity } = require('../middleware/passwordValidation');

// Set CSRF token cookie (non-HTTP-only, readable by JavaScript)
const setCsrfTokenCookie = (res, userId) => {
  const csrfToken = generateCsrfToken();
  storeCsrfToken(userId, csrfToken);

  res.cookie('csrfToken', csrfToken, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 15 * 60 * 1000, // 15 minutes
  });

  return csrfToken;
};

// Register with user-set password (PCI DSS compliant)
const register = async (req, res) => {
  try {
    const { email, password, confirmPassword } = req.body;

    // Validate password match
    if (password !== confirmPassword) {
      return res.status(400).json({
        error: 'Password validation failed',
        message: 'Passwords do not match'
      });
    }

    // Validate password complexity
    const validation = validatePasswordComplexity(password);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Password validation failed',
        message: validation.errors.join(', ')
      });
    }

    // Set trial ends at 30 days from now (grace period)
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 30);

    // Create numeric account with user-set password (not active until purchase)
    const user = await User.createNumericAccountWithPassword({
      email,
      password,
      trialEndsAt
    });

    // Generate JWT tokens with user ID as payload object
    const accessToken = generateToken({ id: user.id });
    const refreshToken = generateRefreshToken({ id: user.id });

    // Set CSRF token
    const csrfToken = setCsrfTokenCookie(res, user.id);

    // Set HTTP-only refresh token cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(201).json({
      message: 'Registration successful. Please login and purchase a plan to activate your account.',
      user: {
        id: user.id,
        accountNumber: user.account_number,
        isAffiliate: user.is_affiliate || false,
        isActive: false,
        registeredAt: user.created_at
      },
      accessToken,
      csrfToken
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      error: 'Registration failed',
      message: error.message
    });
  }
};

// Login with password validation and expiration check
const login = async (req, res) => {
  try {
    const { accountNumber, password } = req.body;

    // Find user by account number
    const user = await User.findByAccountNumber(accountNumber);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check if account is active
    if (!user.is_active) {
      // Check if account is within grace period
      const registeredDate = new Date(user.created_at);
      const gracePeriodEnd = new Date(registeredDate);
      gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 30);

      if (new Date() > gracePeriodEnd) {
        return res.status(403).json({
          error: 'Account expired',
          message: 'Your account has expired. Please register again.'
        });
      }

      return res.status(200).json({
        message: 'Login successful. Please purchase a plan to activate your account.',
        user: {
          id: user.id,
          accountNumber: user.account_number,
          email: user.email,
          isAffiliate: user.is_affiliate || false,
          isActive: false,
          gracePeriodEnd: gracePeriodEnd.toISOString()
        },
        accessToken: generateToken({ id: user.id }),
        csrfToken: setCsrfTokenCookie(res, user.id)
      });
    }

    // Generate JWT tokens with user ID as payload object
    const accessToken = generateToken({ id: user.id });
    const refreshToken = generateRefreshToken({ id: user.id });

    // Set CSRF token
    const csrfToken = setCsrfTokenCookie(res, user.id);

    // Set HTTP-only refresh token cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Update last login
    await db.query(
      'UPDATE users SET last_login = NOW() WHERE id = $1',
      [user.id]
    );

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        accountNumber: user.account_number,
        email: user.email,
        isAffiliate: user.is_affiliate || false,
        isActive: true
      },
      accessToken,
      csrfToken
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Login failed',
      message: error.message
    });
  }
};

// Logout
const logout = async (req, res) => {
  try {
    res.clearCookie('refreshToken');
    res.clearCookie('csrfToken');
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
};

// Refresh token
const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token required' });
    }

    const userId = verifyRefreshToken(refreshToken);
    if (!userId) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    // Generate new tokens with user ID as payload object
    const accessToken = generateToken({ id: userId });
    const newRefreshToken = generateRefreshToken({ id: userId });

    // Set CSRF token
    const csrfToken = setCsrfTokenCookie(res, userId);

    // Set HTTP-only refresh token cookie
    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({
      accessToken,
      csrfToken
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(401).json({ error: 'Invalid refresh token' });
  }
};

module.exports = {
  register: [passwordValidationMiddleware, register],
  login,
  logout,
  refreshToken,
};
