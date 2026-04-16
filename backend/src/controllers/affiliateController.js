const argon2 = require('argon2');
const jwt = require('jsonwebtoken');
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
      `SELECT a.id, a.user_id, a.username, a.password_hash, a.status
       FROM affiliates a
       WHERE a.username = $1 AND a.status = 'active'`,
      [username]
    );
    
    if (affiliateResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const affiliate = affiliateResult.rows[0];
    
    // Verify password
    const isValid = await argon2.verify(affiliate.password_hash, password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Generate JWT tokens
    const accessToken = jwt.sign({ userId: affiliate.user_id, affiliateId: affiliate.id, type: 'affiliate' }, process.env.JWT_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign({ userId: affiliate.user_id, affiliateId: affiliate.id }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '7d' });
    
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
    setCsrfTokenCookie(res, affiliate.user_id);
    
    res.json({
      success: true,
      data: {
        affiliateCode: affiliate.username,
        message: 'Login successful'
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

// Create promo code endpoint
const createCode = async (req, res) => {
  try {
    const { code, description, discountType, discountValue, maxUses, expiresAt, planKeys } = req.body;
    
    if (!code || !discountType || discountValue === undefined) {
      return res.status(400).json({ error: 'Code, discount type, and discount value required' });
    }
    
    // Validate discount type
    if (!['percent', 'fixed', 'free_trial'].includes(discountType)) {
      return res.status(400).json({ error: 'Invalid discount type' });
    }
    
    // Check if code already exists
    const existing = await db.query(
      'SELECT id FROM promo_codes WHERE code = $1',
      [code.toUpperCase()]
    );
    
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Promo code already exists' });
    }
    
    // Create promo code
    const promoResult = await db.query(
      `INSERT INTO promo_codes (
        code, description, discount_type, discount_value, max_uses, expires_at,
        applies_to_plan_keys, affiliate_id, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active', NOW(), NOW())
      RETURNING *`,
      [
        code.toUpperCase(),
        description,
        discountType,
        discountValue,
        maxUses,
        expiresAt,
        planKeys,
        req.affiliateId
      ]
    );
    
    // Also create affiliate_link for this code so it shows in dashboard
    const url = 'https://ahoyvpn.net/affiliate/' + code.toUpperCase();
    try {
      const linkResult = await db.query(
        'INSERT INTO affiliate_links (affiliate_id, code, url, active) VALUES ($1, $2, $3, true) RETURNING id',
        [req.affiliateId, code.toUpperCase(), url]
      );
      const linkId = linkResult.rows[0].id;
      const discountCents = discountType === 'fixed' ? parseInt(discountValue) : 0;
      if (discountCents > 0) {
        await db.query(
          'INSERT INTO affiliate_link_discounts (affiliate_link_id, discount_cents) VALUES ($1, $2) ON CONFLICT (affiliate_link_id) DO UPDATE SET discount_cents = $2',
          [linkId, discountCents]
        );
      }
    } catch (linkErr) {
      console.log('Affiliate link creation note:', linkErr.message);
    }

    res.json({
      success: true,
      data: promoResult.rows[0],
      message: 'Promo code created successfully'
    });
  } catch (error) {
    console.error('Create promo code error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get promo codes endpoint
const getCodes = async (req, res) => {
  try {
    const codesResult = await db.query(
      `SELECT pc.*, 
        (SELECT COUNT(*) FROM subscriptions s WHERE s.promo_code_id = pc.id) as uses_count
       FROM promo_codes pc
       WHERE pc.affiliate_id = $1
       ORDER BY pc.created_at DESC`,
      [req.affiliateId]
    );
    
    res.json({
      success: true,
      data: codesResult.rows
    });
  } catch (error) {
    console.error('Get promo codes error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete promo code
const deleteCode = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Try affiliate_links first (new system), then promo_codes (legacy)
    const linkExisting = await db.query(
      'SELECT id, code FROM affiliate_links WHERE id = $1 AND affiliate_id = $2',
      [id, req.affiliateId]
    );
    
    if (linkExisting.rows.length > 0) {
      // Delete discount first (FK), then link
      await db.query('DELETE FROM affiliate_link_discounts WHERE affiliate_link_id = $1', [id]);
      await db.query('DELETE FROM affiliate_links WHERE id = $1', [id]);
      return res.json({ success: true, message: `Code "${linkExisting.rows[0].code}" deleted` });
    }
    
    // Fallback: check promo_codes
    const promoExisting = await db.query(
      'SELECT id, code FROM promo_codes WHERE id = $1 AND affiliate_id = $2',
      [id, req.affiliateId]
    );
    
    if (promoExisting.rows.length === 0) {
      return res.status(404).json({ error: 'Code not found' });
    }
    
    // Also delete matching affiliate_link if exists
    await db.query('DELETE FROM affiliate_link_discounts WHERE affiliate_link_id IN (SELECT id FROM affiliate_links WHERE code = $1)', [promoExisting.rows[0].code]);
    await db.query('DELETE FROM affiliate_links WHERE code = $1 AND affiliate_id = $2', [promoExisting.rows[0].code, req.affiliateId]);
    await db.query('DELETE FROM promo_codes WHERE id = $1', [id]);
    
    res.json({
      success: true,
      message: `Code "${promoExisting.rows[0].code}" deleted`
    });
  } catch (error) {
    console.error('Delete promo code error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Generate affiliate link endpoint
const generateAffiliateLink = async (req, res) => {
  try {
    // Get affiliate username for the shareable link
    const affiliateResult = await db.query(
      `SELECT username FROM affiliates WHERE id = $1`,
      [req.affiliateId]
    );
    
    if (affiliateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Affiliate not found' });
    }
    
    const username = affiliateResult.rows[0].username;
    const baseUrl = process.env.FRONTEND_URL || 'https://ahoyvpn.net';
    const link = `${baseUrl}/affiliate/${username}`;
    
    // Shareable link uses affiliate username, not promo code
    const linkData = {
      code: username,
      link: link,
      created_at: new Date().toISOString(),
      status: 'active',
      signups: 0
    };
    
    res.json({
      success: true,
      data: linkData
    });
  } catch (error) {
    console.error('Generate affiliate link error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get metrics endpoint (real-time)
const getMetrics = async (req, res) => {
  try {
    // Get affiliate username for the shareable link
    const affiliateResult = await db.query(
      `SELECT username FROM affiliates WHERE id = $1`,
      [req.affiliateId]
    );
    const affiliateUsername = affiliateResult.rows[0]?.username || '';
    const baseUrl = process.env.FRONTEND_URL || 'https://ahoyvpn.net';
    
    // Signups and conversions from referrals table
    const referralsResult = await db.query(
      `SELECT
        COUNT(*) as signups,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_referrals
       FROM referrals
       WHERE affiliate_id = $1`,
      [req.affiliateId]
    );
    
    // Earnings from transactions table (type='commission', positive=credit)
    const earningsResult = await db.query(
      `SELECT
        COALESCE(SUM(CASE WHEN paid_out_at IS NOT NULL THEN amount_cents ELSE 0 END), 0) as paid_cents,
        COALESCE(SUM(CASE WHEN paid_out_at IS NULL THEN amount_cents ELSE 0 END), 0) as pending_cents
       FROM transactions
       WHERE affiliate_id = $1 AND type = 'commission'`,
      [req.affiliateId]
    );
    
    const metrics = referralsResult.rows[0];
    const signups = parseInt(metrics.signups) || 0;
    const activeReferrals = parseInt(metrics.active_referrals) || 0;
    const paidCents = parseInt(earningsResult.rows[0]?.paid_cents) || 0;
    const pendingCents = parseInt(earningsResult.rows[0]?.pending_cents) || 0;
    
    // Build shareable link using affiliate username
    const links = [{
      code: affiliateUsername,
      link: `${baseUrl}/affiliate/${affiliateUsername}`,
      created_at: new Date().toISOString(),
      status: 'active',
      signups: signups
    }];
    
    res.json({
      success: true,
      data: {
        signups,
        conversions: activeReferrals,
        activeSubscriptions: activeReferrals,
        earnings: {
          total: ((paidCents + pendingCents) / 100).toFixed(2),
          pending: (pendingCents / 100).toFixed(2),
          paid: (paidCents / 100).toFixed(2)
        },
        links,
        username: affiliateUsername,
        affiliateLink: `${baseUrl}/affiliate/${affiliateUsername}`,
        totalReferrals: signups,
        referralsByStatus: [],
        referralsByDay: [],
        conversionRate: signups > 0 ? Math.round((activeReferrals / signups) * 100) : 0
      }
    });
  } catch (error) {
    console.error('Get metrics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get earnings endpoint
const getEarnings = async (req, res) => {
  try {
    // Get affiliate summary from transactions table
    const summaryResult = await db.query(
      `SELECT
         COALESCE(SUM(CASE WHEN type = 'commission' AND paid_out_at IS NOT NULL THEN amount_cents ELSE 0 END), 0) as paid_out_cents,
         COALESCE(SUM(CASE WHEN type = 'commission' AND paid_out_at IS NULL THEN amount_cents ELSE 0 END), 0) as pending_payout_cents,
         COALESCE(SUM(CASE WHEN type = 'commission' THEN amount_cents ELSE 0 END), 0) as total_earned_cents
       FROM transactions
       WHERE affiliate_id = $1`,
      [req.affiliateId]
    );
    
    // Get ledger items (transactions as ledger)
    const ledgerResult = await db.query(
      `SELECT id, created_at, type, amount_cents, description, paid_out_at
       FROM transactions
       WHERE affiliate_id = $1 AND type = 'commission'
       ORDER BY created_at DESC
       LIMIT 50`,
      [req.affiliateId]
    );
    
    res.json({
      success: true,
      data: {
        summary: summaryResult.rows[0],
        ledger: ledgerResult.rows
      }
    });
  } catch (error) {
    console.error('Get earnings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get referral performance endpoint
const getReferralPerformance = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    
    // Get referrals — only use columns that actually exist in the referrals table
    const referralsResult = await db.query(
      `SELECT id, plan, amount_cents, transaction_date, status, created_at
       FROM referrals
       WHERE affiliate_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.affiliateId, limit, offset]
    );
    
    // Get total count
    const countResult = await db.query(
      'SELECT COUNT(*) as count FROM referrals WHERE affiliate_id = $1',
      [req.affiliateId]
    );
    
    res.json({
      success: true,
      data: referralsResult.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].count),
        pages: Math.ceil(countResult.rows[0].count / limit)
      }
    });
  } catch (error) {
    console.error('Get referral performance error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get payout history endpoint
const getPayoutHistory = async (req, res) => {
  try {
    const payoutsResult = await db.query(
      `SELECT id, amount_cents, status, requested_at, processed_at, notes
       FROM payout_requests
       WHERE affiliate_id = $1
       ORDER BY requested_at DESC`,
      [req.affiliateId]
    );
    
    res.json({
      success: true,
      data: payoutsResult.rows
    });
  } catch (error) {
    console.error('Get payout history error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Request payout endpoint (creates a payout request)
const requestPayout = async (req, res) => {
  try {
    const { amount } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than 0' });
    }
    
    // Get affiliate pending balance from transactions
    const balanceResult = await db.query(
      `SELECT COALESCE(SUM(amount_cents), 0) as pending_payout_cents
       FROM transactions
       WHERE affiliate_id = $1 AND type = 'commission' AND paid_out_at IS NULL`,
      [req.affiliateId]
    );
    
    const pendingCents = parseInt(balanceResult.rows[0].pending_payout_cents) || 0;
    const amountCents = Math.round(amount * 100);
    
    // Check minimum payout (default $50)
    const minPayoutCents = 5000; // $50
    if (amountCents < minPayoutCents) {
      return res.status(400).json({ error: `Minimum payout is $${minPayoutCents / 100}` });
    }
    
    // Check if amount exceeds available balance
    if (amountCents > pendingCents) {
      return res.status(400).json({ error: 'Amount exceeds available balance' });
    }
    
    // Create payout request
    const payoutResult = await db.query(
      `INSERT INTO payout_requests (affiliate_id, amount_cents, status, requested_at)
       VALUES ($1, $2, 'pending', NOW())
       RETURNING id, amount_cents, status, requested_at`,
      [req.affiliateId, amountCents]
    );
    
    res.json({
      success: true,
      data: payoutResult.rows[0],
      message: 'Payout request submitted. Email Ahoyvpn@ahoyvpn.net to complete.'
    });
  } catch (error) {
    console.error('Request payout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Change password endpoint
const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: 'Old and new password required' });
    }
    
    // Get affiliate user ID
    const affiliateResult = await db.query(
      `SELECT a.user_id, a.password_hash
       FROM affiliates a
       WHERE a.id = $1`,
      [req.affiliateId]
    );
    
    if (affiliateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Affiliate not found' });
    }
    
    const { user_id, password_hash } = affiliateResult.rows[0];
    
    // Verify old password
    const isValid = await argon2.verify(password_hash, oldPassword);
    if (!isValid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
    
    // Hash new password
    const newPasswordHash = await argon2.hash(newPassword);
    
    // Update password
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

// Get recovery kit endpoint
const getRecoveryKit = async (req, res) => {
  try {
    // Get user ID from affiliate
    const affiliateResult = await db.query(
      'SELECT user_id FROM affiliates WHERE id = $1',
      [req.affiliateId]
    );
    
    if (affiliateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Affiliate not found' });
    }
    
    const userId = affiliateResult.rows[0].user_id;
    
    // Get active recovery kit
    const kitResult = await db.query(
      `SELECT id, created_at, last_shown_at
       FROM recovery_kits
       WHERE user_id = $1 AND is_active = true`,
      [userId]
    );
    
    if (kitResult.rows.length === 0) {
      return res.status(404).json({ error: 'No active recovery kit found' });
    }
    
    res.json({
      success: true,
      data: kitResult.rows[0]
    });
  } catch (error) {
    console.error('Get recovery kit error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Regenerate recovery kit endpoint
const regenerateRecoveryKit = async (req, res) => {
  try {
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({ error: 'Password required' });
    }
    
    // Get affiliate user ID and password hash
    const affiliateResult = await db.query(
      `SELECT a.user_id, a.password_hash
       FROM affiliates a
       WHERE a.id = $1`,
      [req.affiliateId]
    );
    
    if (affiliateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Affiliate not found' });
    }
    
    const { user_id, password_hash } = affiliateResult.rows[0];
    
    // Verify password
    const isValid = await argon2.verify(password_hash, password);
    if (!isValid) {
      return res.status(401).json({ error: 'Password is incorrect' });
    }
    
    // Deactivate existing active kit
    await db.query(
      'UPDATE recovery_kits SET is_active = false, revoked_at = NOW() WHERE user_id = $1 AND is_active = true',
      [user_id]
    );
    
    // Generate new kit
    const newKit = crypto.randomBytes(16).toString('hex');
    const kitHash = await argon2.hash(newKit);
    
    await db.query(
      `INSERT INTO recovery_kits (user_id, kit_hash, is_active, created_at)
       VALUES ($1, $2, true, NOW())`,
      [user_id, kitHash]
    );
    
    res.json({
      success: true,
      data: { recoveryKit: newKit },
      message: 'Recovery kit regenerated successfully'
    });
  } catch (error) {
    console.error('Regenerate recovery kit error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  login,
  logout,
  createCode,
  getCodes,
  deleteCode,
  generateAffiliateLink,
  getMetrics,
  getEarnings,
  getReferralPerformance,
  getPayoutHistory,
  requestPayout,
  changePassword,
  getRecoveryKit,
  regenerateRecoveryKit
};
