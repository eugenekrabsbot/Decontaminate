const { verifyToken } = require('../utils/jwt');
const User = require('../models/userModel');

const protect = async (req, res, next) => {
  let token;
  // Try cookie first
  if (req.cookies && req.cookies.accessToken) {
    token = req.cookies.accessToken;
  }
  // Fallback to Authorization header
  else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  const isApiRoute = req.originalUrl.startsWith('/api');
  console.error(`[protect] originalUrl=${req.originalUrl}, isApiRoute=${isApiRoute}, token=${!!token}, path=${req.path}`);

  if (!token) {
    // For API routes, return JSON error; for web pages, redirect to login
    if (!isApiRoute) {
      console.error(`[protect] redirecting to login`);
      return res.redirect('/login.html?redirect=' + encodeURIComponent(req.originalUrl));
    }
    console.error(`[protect] returning JSON 401 (API route)`);
    return res.status(401).json({ error: 'Not authorized, no token' });
  }

  try {
    const decoded = verifyToken(token);
    if (!decoded) {
      if (!isApiRoute) {
        return res.redirect('/login.html?redirect=' + encodeURIComponent(req.originalUrl));
      }
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Support both 'id' (customer tokens) and 'userId' (legacy) JWT formats
    const tokenUserId = decoded.id ?? decoded.userId;
    if (!tokenUserId) {
      if (!isApiRoute) {
        return res.redirect('/login.html?redirect=' + encodeURIComponent(req.originalUrl));
      }
      return res.status(401).json({ error: 'Invalid token payload' });
    }

    const user = await User.findById(tokenUserId);
    if (!user) {
      if (!isApiRoute) {
        return res.redirect('/login.html?redirect=' + encodeURIComponent(req.originalUrl));
      }
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (!isApiRoute) {
      return res.redirect('/login.html?redirect=' + encodeURIComponent(req.originalUrl));
    }
    return res.status(401).json({ error: 'Not authorized' });
  }
};

// Middleware to allow inactive users for specific routes (e.g., plans endpoint)
const allowInactive = async (req, res, next) => {
  let token;
  // Try cookie first
  if (req.cookies && req.cookies.accessToken) {
    token = req.cookies.accessToken;
  }
  // Fallback to Authorization header
  else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ error: 'Not authorized, no token' });
  }

  try {
    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Support both 'id' (customer tokens) and 'userId' (legacy) JWT formats
    const tokenUserId = decoded.id ?? decoded.userId;
    if (!tokenUserId) {
      return res.status(401).json({ error: 'Invalid token payload' });
    }

    const user = await User.findById(tokenUserId);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Not authorized' });
  }
};

// Middleware to require 2FA verification
const require2FA = async (req, res, next) => {
  try {
    // Check if 2FA is enabled for the user
    if (req.user.totp_enabled) {
      // Check if 2FA was verified recently (within last 30 minutes)
      const last2FAVerification = req.user.last_2fa_verification;
      if (last2FAVerification) {
        const lastVerification = new Date(last2FAVerification);
        const now = new Date();
        const minutesSinceVerification = (now - lastVerification) / (1000 * 60);

        if (minutesSinceVerification < 30) {
          // 2FA verified recently, allow request
          return next();
        }
      }

      // 2FA not verified recently, require verification
      return res.status(403).json({
        error: '2FA required',
        message: 'Two-factor authentication is required for this action',
        requires2FA: true
      });
    }

    // 2FA not enabled, allow request
    next();
  } catch (error) {
    console.error('2FA middleware error:', error);
    next();
  }
};

module.exports = { protect, allowInactive, require2FA };
