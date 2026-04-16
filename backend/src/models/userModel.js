const db = require('../config/database');
const bcrypt = require('bcrypt');
const { validatePasswordComplexity, isPasswordReused, hashPassword, addToPasswordHistory, SALT_ROUNDS } = require('../middleware/passwordValidation');

const User = {
  // Generate numeric account number (8 digits)
  generateAccountNumber() {
    return String(Math.floor(Math.random() * 100000000)).padStart(8, '0');
  },

  // Generate numeric password (8 digits) - DEPRECATED for PCI compliance
  generateNumericPassword() {
    return String(Math.floor(Math.random() * 100000000)).padStart(8, '0');
  },

  // Create numeric account (called after payment confirmation) - DEPRECATED
  async createNumericAccount({ email = null, trialEndsAt = null }) {
    // Generate numeric credentials
    const accountNumber = this.generateAccountNumber();
    const numericPassword = this.generateNumericPassword();
    const numericPasswordHash = await bcrypt.hash(numericPassword, SALT_ROUNDS);

    const query = `
      INSERT INTO users (
        email, password_hash, account_number, numeric_password_hash, 
        is_numeric_account, is_active, trial_ends_at, created_at, updated_at,
        password_changed_at, force_password_change
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW(), NOW(), true)
      RETURNING id, account_number, numeric_password_hash, trial_ends_at, created_at
    `;
    
    const values = [
      email, // Optional email (not used for login)
      numericPasswordHash, // Store as password_hash for compatibility
      accountNumber,
      numericPasswordHash,
      true, // is_numeric_account
      true, // is_active
      trialEndsAt
    ];
    
    const result = await db.query(query, values);
    
    return {
      ...result.rows[0],
      numericPassword // Return plaintext password to show user once
    };
  },

  // Create numeric account with user-set password (PCI DSS compliant)
  async createNumericAccountWithPassword({ email, password, trialEndsAt = null }) {
    // Validate password complexity
    const validation = validatePasswordComplexity(password);
    if (!validation.valid) {
      throw new Error(`Password validation failed: ${validation.errors.join(', ')}`);
    }

    // Generate account number
    const accountNumber = this.generateAccountNumber();
    
    // Hash the password
    const passwordHash = await hashPassword(password);

    const query = `
      INSERT INTO users (
        email, account_number, password_hash, is_numeric_account, is_active, 
        trial_ends_at, created_at, updated_at, password_changed_at, 
        force_password_change
      )
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW(), NOW(), false)
      RETURNING id, email, account_number, is_numeric_account, is_active, trial_ends_at, created_at
    `;
    
    const values = [
      email || null,
      accountNumber,
      passwordHash,
      true, // is_numeric_account
      false, // is_active (not active until purchase)
      trialEndsAt
    ];
    
    const result = await db.query(query, values);
    
    // Add to password history
    await addToPasswordHistory(result.rows[0].id, passwordHash);
    
    return result.rows[0];
  },

  // Create traditional email-based account with user-set password
  async create({ email, password, trialEndsAt, isAffiliate = false }) {
    // Validate password complexity
    const validation = validatePasswordComplexity(password);
    if (!validation.valid) {
      throw new Error(`Password validation failed: ${validation.errors.join(', ')}`);
    }

    // Hash the password
    const passwordHash = await hashPassword(password);

    const query = `
      INSERT INTO users (
        email, password_hash, is_affiliate, is_active, trial_ends_at, 
        created_at, updated_at, password_changed_at, force_password_change
      )
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), NOW(), false)
      RETURNING id, email, is_affiliate, is_active, trial_ends_at, created_at
    `;
    
    const values = [
      email,
      passwordHash,
      isAffiliate,
      true, // is_active
      trialEndsAt
    ];
    
    const result = await db.query(query, values);
    
    // Add to password history
    await addToPasswordHistory(result.rows[0].id, passwordHash);
    
    return result.rows[0];
  },

  // Create admin user with user-set password
  async createAdmin({ username, password }) {
    // Validate password complexity
    const validation = validatePasswordComplexity(password);
    if (!validation.valid) {
      throw new Error(`Password validation failed: ${validation.errors.join(', ')}`);
    }

    // Hash the password
    const passwordHash = await hashPassword(password);

    const query = `
      INSERT INTO admin_users (
        username, password_hash, role, is_active, created_at, updated_at
      )
      VALUES ($1, $2, 'admin', true, NOW(), NOW())
      RETURNING id, username, role, is_active
    `;
    
    const values = [username, passwordHash];
    
    const result = await db.query(query, values);
    
    return result.rows[0];
  },

  // Update user password with validation
  async updatePassword(userId, newPassword, oldPassword = null) {
    // Validate new password complexity
    const validation = validatePasswordComplexity(newPassword);
    if (!validation.valid) {
      throw new Error(`Password validation failed: ${validation.errors.join(', ')}`);
    }

    // Check if password was used in last 4 passwords
    const isReused = await isPasswordReused(userId, newPassword);
    if (isReused) {
      throw new Error('Cannot reuse any of your last 4 passwords');
    }

    // If old password provided, verify it
    if (oldPassword) {
      const user = await this.findById(userId);
      const isValid = await bcrypt.compare(oldPassword, user.password_hash);
      if (!isValid) {
        throw new Error('Current password is incorrect');
      }
    }

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword);

    // Update password and clear force_password_change flag
    const query = `
      UPDATE users 
      SET password_hash = $1, 
          password_changed_at = NOW(), 
          force_password_change = false,
          updated_at = NOW()
      WHERE id = $2
      RETURNING id, email, password_changed_at
    `;
    
    const result = await db.query(query, [newPasswordHash, userId]);
    
    // Add to password history
    await addToPasswordHistory(userId, newPasswordHash);
    
    return result.rows[0];
  },

  // Find user by ID
  async findById(id) {
    const query = `SELECT * FROM users WHERE id = $1`;
    const result = await db.query(query, [id]);
    return result.rows[0];
  },

  // Find user by email
  async findByEmail(email) {
    const query = `SELECT * FROM users WHERE email = $1`;
    const result = await db.query(query, [email]);
    return result.rows[0];
  },

  // Find user by account number
  async findByAccountNumber(accountNumber) {
    const query = `SELECT * FROM users WHERE account_number = $1`;
    const result = await db.query(query, [accountNumber]);
    return result.rows[0];
  },

  // Verify password
  async verifyPassword(userId, password) {
    const user = await this.findById(userId);
    if (!user) {
      return false;
    }
    return await bcrypt.compare(password, user.password_hash);
  },

  // Compare password directly with hash (used by authController)
  async comparePassword(password, hash) {
    if (!hash) return false;
    return await bcrypt.compare(password, hash);
  },

  // Check if password needs to be changed
  async needsPasswordChange(userId) {
    const user = await this.findById(userId);
    if (!user) {
      return false;
    }

    // Check force_password_change flag
    if (user.force_password_change) {
      return true;
    }

    // Check 90-day expiration
    const passwordChangedAt = new Date(user.password_changed_at);
    const now = new Date();
    const daysSinceChange = (now - passwordChangedAt) / (1000 * 60 * 60 * 24);

    return daysSinceChange > 90;
  }
};

module.exports = User;
