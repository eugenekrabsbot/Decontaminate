#!/usr/bin/env python3
import re

with open('/home/ahoy/BackEnd/src/middleware/authMiddleware_new.js', 'r') as f:
    content = f.read()

# Fix 1: Update protect function to accept adminId
old_protect = '''const protect = async (req, res, next) => {
  try {
    // Try to get token from cookies first, then Authorization header
    let token = req.cookies?.accessToken;

    if (!token && req.headers.authorization) {
      const authHeader = req.headers.authorization;
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId || decoded.id;
    if (!userId) {
      return res.status(401).json({ error: 'Invalid token payload' });
    }
    req.user = { id: userId };

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};'''

new_protect = '''const protect = async (req, res, next) => {
  try {
    // Try to get token from cookies first, then Authorization header
    let token = req.cookies?.accessToken;

    if (!token && req.headers.authorization) {
      const authHeader = req.headers.authorization;
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Support both user tokens (userId/id) and admin tokens (adminId)
    const userId = decoded.userId || decoded.id || decoded.adminId;
    if (!userId) {
      return res.status(401).json({ error: 'Invalid token payload' });
    }

    req.user = {
      id: userId,
      adminId: decoded.adminId || null,
      role: decoded.role || null,
      type: decoded.type || null
    };

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};'''

content = content.replace(old_protect, new_protect)

# Fix 2: Update requireRole to check admin_users table for admin role
old_requireRole = '''const requireRole = (role) => {
  return async (req, res, next) => {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Check if user has the required role
    const query = 'SELECT is_admin FROM users WHERE id = $1';
    const result = await db.query(query, [req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    if (role === 'admin' && !user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    next();
  };
};'''

new_requireRole = '''const requireRole = (role) => {
  return async (req, res, next) => {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Handle admin role - check admin_users table
    if (role === 'admin') {
      const query = 'SELECT role FROM admin_users WHERE id = $1 AND is_active = true';
      const result = await db.query(query, [req.user.id]);

      if (result.rows.length === 0) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      req.user.role = result.rows[0].role;
      return next();
    }

    // Check if user has the required role (non-admin)
    const query = 'SELECT is_admin FROM users WHERE id = $1';
    const result = await db.query(query, [req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    if (role === 'admin' && !user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    next();
  };
};'''

content = content.replace(old_requireRole, new_requireRole)

with open('/home/ahoy/BackEnd/src/middleware/authMiddleware_new.js', 'w') as f:
    f.write(content)

print("Auth middleware fixed")
