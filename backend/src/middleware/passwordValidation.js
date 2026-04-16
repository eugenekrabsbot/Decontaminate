const bcrypt = require('bcrypt');
const db = require('../config/database');

const SALT_ROUNDS = 12;

/**
 * PCI DSS Password Validation
 * Requirements:
 * - Minimum length: 12 characters (or 8 if system doesn't support 12)
 * - Must contain both numeric and alphabetic characters
 * - Cannot be same as last 4 passwords
 * - Changed at least once every 90 days (if single-factor)
 */

/**
 * Validate password complexity
 * @param {string} password - Password to validate
 * @returns {Object} - { valid: boolean, errors: string[] }
 */
function validatePasswordComplexity(password) {
  const errors = [];

  // Check minimum length (12 characters required, 8 minimum allowed)
  if (password.length < 12) {
    errors.push('Password must be at least 12 characters long');
  }

  // Check for alphabetic characters
  if (!/[A-Za-z]/.test(password)) {
    errors.push('Password must contain at least one letter');
  }

  // Check for numeric characters
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  // Check for special characters (recommended but not required by PCI DSS)
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    // Optional: Add warning or requirement for special characters
    // errors.push('Password should contain at least one special character');
  }

  // Check for common passwords (basic check)
  const commonPasswords = [
    'password', '123456', 'qwerty', 'abc123', 'password123',
    'letmein', 'welcome', 'admin', 'user', 'test'
  ];
  
  if (commonPasswords.includes(password.toLowerCase())) {
    errors.push('Password is too common');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Check if password was used in last 4 passwords
 * @param {string} userId - User ID
 * @param {string} password - Password to check
 * @returns {Promise<boolean>} - true if password was used before
 */
async function isPasswordReused(userId, password) {
  try {
    const result = await db.query(
      `SELECT password_hash FROM password_history 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT 4`,
      [userId]
    );

    for (const row of result.rows) {
      const isMatch = await bcrypt.compare(password, row.password_hash);
      if (isMatch) {
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error('Error checking password history:', error);
    return false;
  }
}

/**
 * Check if password needs to be changed (90-day rule)
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} - true if password needs to be changed
 */
async function isPasswordExpired(userId) {
  try {
    const result = await db.query(
      `SELECT password_changed_at FROM users WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return false;
    }

    const passwordChangedAt = new Date(result.rows[0].password_changed_at);
    const now = new Date();
    const daysSinceChange = (now - passwordChangedAt) / (1000 * 60 * 60 * 24);

    return daysSinceChange > 90;
  } catch (error) {
    console.error('Error checking password expiration:', error);
    return false;
  }
}

/**
 * Hash password using bcrypt
 * @param {string} password - Plain text password
 * @returns {Promise<string>} - Hashed password
 */
async function hashPassword(password) {
  return await bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Add password to history
 * @param {string} userId - User ID
 * @param {string} passwordHash - Hashed password
 */
async function addToPasswordHistory(userId, passwordHash) {
  try {
    await db.query(
      `INSERT INTO password_history (user_id, password_hash) VALUES ($1, $2)`,
      [userId, passwordHash]
    );

    // Keep only last 4 passwords
    await db.query(
      `DELETE FROM password_history 
       WHERE user_id = $1 
       AND id NOT IN (
         SELECT id FROM password_history 
         WHERE user_id = $1 
         ORDER BY created_at DESC 
         LIMIT 4
       )`,
      [userId]
    );
  } catch (error) {
    console.error('Error adding to password history:', error);
  }
}

/**
 * Middleware to validate password on registration/password change
 */
const passwordValidationMiddleware = (req, res, next) => {
  const { password, confirmPassword } = req.body;

  // Check if passwords match
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

  next();
};

/**
 * Check if user is forced to change password
 */
const requirePasswordChange = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    // Check if password needs to be changed
    const needsChange = await isPasswordExpired(userId);
    
    if (needsChange) {
      return res.status(403).json({
        error: 'Password expired',
        message: 'Your password has expired. Please change it to continue.',
        requiresPasswordChange: true
      });
    }

    // Check if forced password change flag is set
    const result = await db.query(
      `SELECT force_password_change FROM users WHERE id = $1`,
      [userId]
    );

    if (result.rows.length > 0 && result.rows[0].force_password_change) {
      return res.status(403).json({
        error: 'Password change required',
        message: 'Please change your password on first login.',
        requiresPasswordChange: true
      });
    }

    next();
  } catch (error) {
    console.error('Error checking password change requirement:', error);
    next();
  }
};

module.exports = {
  validatePasswordComplexity,
  isPasswordReused,
  isPasswordExpired,
  hashPassword,
  addToPasswordHistory,
  passwordValidationMiddleware,
  requirePasswordChange,
  SALT_ROUNDS
};
