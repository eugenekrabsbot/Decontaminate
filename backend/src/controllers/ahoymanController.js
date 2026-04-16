const argon2 = require('argon2');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { setCsrfTokenCookie } = require('../middleware/authMiddleware_new');

// ============ AUTH ============

const adminLogin = async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }
    
    const adminResult = await db.query(
      'SELECT id, username, password_hash, role FROM admin_users WHERE username = $1 AND is_active = true',
      [username]
    );
    
    if (adminResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const admin = adminResult.rows[0];
    const isValid = await argon2.verify(admin.password_hash, password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const accessToken = jwt.sign({ adminId: admin.id, role: admin.role, type: 'admin' }, process.env.JWT_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign({ adminId: admin.id, role: admin.role, type: 'admin' }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '7d' });
    
    res.cookie('accessToken', accessToken, { httpOnly: true, secure: true, sameSite: 'none', path: '/', maxAge: 15 * 60 * 1000 });
    res.cookie('refreshToken', refreshToken, { httpOnly: true, secure: true, sameSite: 'none', path: '/', maxAge: 7 * 24 * 60 * 60 * 1000 });
    setCsrfTokenCookie(res, admin.id);

    // Also return token in body for localStorage use
    res.json({ success: true, data: { username: admin.username, role: admin.role, token: accessToken } });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const adminLogout = async (req, res) => {
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
  res.clearCookie('csrfToken');
  res.json({ success: true });
};

// ============ DASHBOARD ============

const getDashboardMetrics = async (req, res) => {
  try {
    const statsResult = await db.query(`
      SELECT
        (SELECT COUNT(*) FROM affiliates) as total_affiliates,
        (SELECT COUNT(*) FROM affiliates WHERE status = 'active') as active_affiliates,
        (SELECT COUNT(*) FROM referrals WHERE status = 'active') as active_referrals,
        (SELECT COUNT(*) FROM referrals) as total_referrals,
        (SELECT COALESCE(SUM(amount_cents), 0) FROM transactions WHERE type = 'commission') as total_earned_cents,
        (SELECT COALESCE(SUM(amount_cents), 0) FROM transactions WHERE type = 'payout') as total_paid_cents,
        (SELECT COALESCE(SUM(amount_cents), 0) FROM payout_requests WHERE status = 'pending') as pending_payout_cents
    `);
    
    const stats = statsResult.rows[0];
    
    res.json({
      success: true,
      data: {
        totalAffiliates: parseInt(stats.total_affiliates) || 0,
        activeAffiliates: parseInt(stats.active_affiliates) || 0,
        totalReferredCustomers: parseInt(stats.total_referrals) || 0,
        activeReferrals: parseInt(stats.active_referrals) || 0,
        totalCommissionsPaid: (parseInt(stats.total_paid_cents) || 0) / 100,
        pendingPayouts: (parseInt(stats.pending_payout_cents) || 0) / 100,
        totalEarned: (parseInt(stats.total_earned_cents) || 0) / 100
      }
    });
  } catch (error) {
    console.error('Get dashboard metrics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ============ AFFILIATE MANAGEMENT ============

const getAffiliates = async (req, res) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    // Subqueries (LEFT JOINs) must select only the affiliate_id from the group
    let txSub = `(SELECT affiliate_id,
               SUM(CASE WHEN type = 'commission' THEN amount_cents ELSE 0 END) as total_earned_cents,
               SUM(CASE WHEN type = 'payout' THEN ABS(amount_cents) ELSE 0 END) as total_paid_cents
        FROM transactions GROUP BY affiliate_id)`;
    let refsSub = `(SELECT affiliate_id,
               COUNT(DISTINCT id) as total_referrals,
               COUNT(DISTINCT CASE WHEN status = 'active' THEN id END) as active_referrals
        FROM referrals GROUP BY affiliate_id)`;

    let query = `
      SELECT
        a.id, a.username, a.status, a.created_at,
        COALESCE(tx.total_earned_cents, 0) as total_earned_cents,
        COALESCE(tx.total_paid_cents, 0) as total_paid_cents,
        COALESCE(refs.total_referrals, 0) as total_referrals,
        COALESCE(refs.active_referrals, 0) as active_referrals
      FROM affiliates a
      LEFT JOIN ${txSub} tx ON a.id = tx.affiliate_id
      LEFT JOIN ${refsSub} refs ON a.id = refs.affiliate_id
      WHERE 1=1
    `;

    const params = [];
    let paramCount = 1;

    if (status) {
      query += ` AND a.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    if (search) {
      query += ` AND a.username ILIKE $${paramCount}`;
      params.push(`%${search}%`);
      paramCount++;
    }

    query += ` ORDER BY a.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(parseInt(limit), offset);
    
    const result = await db.query(query, params);
    
    // Count
    let countQuery = 'SELECT COUNT(*) FROM affiliates WHERE 1=1';
    if (status) countQuery += ` AND status = $1`;
    if (search) countQuery += status ? ' AND username ILIKE $2' : ' AND username ILIKE $1';
    const countResult = await db.query(countQuery, params.slice(0, status && search ? 2 : status || search ? 1 : 0));
    
    const affiliates = result.rows.map(a => ({
      ...a,
      totalEarned: a.total_earned_cents / 100,
      totalPaid: a.total_paid_cents / 100,
      pendingBalance: (a.total_earned_cents - a.total_paid_cents) / 100
    }));
    
    res.json({
      success: true,
      data: affiliates,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].count),
        pages: Math.ceil(countResult.rows[0].count / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get affiliates error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getAffiliate = async (req, res) => {
  try {
    const { id } = req.params;
    
    const affiliateResult = await db.query(
      'SELECT id, username, status, created_at, suspended_at FROM affiliates WHERE id = $1',
      [id]
    );
    
    if (affiliateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Affiliate not found' });
    }
    
    // Aggregate transactions and referrals separately to avoid cartesian join inflation
    const txResult = await db.query(`
      SELECT
        COALESCE(SUM(CASE WHEN type = 'commission' THEN amount_cents ELSE 0 END), 0) as total_earned_cents,
        COALESCE(SUM(CASE WHEN type = 'payout' THEN ABS(amount_cents) ELSE 0 END), 0) as total_paid_cents
      FROM transactions
      WHERE affiliate_id = $1
    `, [id]);
    
    const refStatsResult = await db.query(`
      SELECT
        COUNT(DISTINCT id) as total_referrals,
        COUNT(DISTINCT CASE WHEN status = 'active' THEN id END) as active_referrals
      FROM referrals
      WHERE affiliate_id = $1
    `, [id]);
    
    const tx = txResult.rows[0];
    const refStats = refStatsResult.rows[0];
    
    res.json({
      success: true,
      data: {
        ...affiliateResult.rows[0],
        totalEarned: (parseInt(tx.total_earned_cents) || 0) / 100,
        totalPaid: (parseInt(tx.total_paid_cents) || 0) / 100,
        pendingBalance: ((parseInt(tx.total_earned_cents) || 0) - (parseInt(tx.total_paid_cents) || 0)) / 100,
        totalReferrals: parseInt(refStats.total_referrals) || 0,
        activeReferrals: parseInt(refStats.active_referrals) || 0
      }
    });
  } catch (error) {
    console.error('Get affiliate error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const createAffiliate = async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }
    
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    
    // Check if username exists
    const existing = await db.query('SELECT id FROM affiliates WHERE username = $1', [username]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Username already taken' });
    }
    
    const passwordHash = await argon2.hash(password);
    
    // Generate 10 recovery codes
    const codes = [];
    for (let i = 0; i < 10; i++) {
      codes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
    }
    const hashedCodes = await Promise.all(codes.map(c => argon2.hash(c)));
    
    const affiliateResult = await db.query(
      `INSERT INTO affiliates (username, password_hash, recovery_codes_hash, status)
       VALUES ($1, $2, $3, 'active')
       RETURNING id, username, status, created_at`,
      [username, passwordHash, JSON.stringify(hashedCodes)]
    );
    
    res.json({
      success: true,
      data: { ...affiliateResult.rows[0], recoveryCodes: codes },
      message: 'Affiliate created. Give them their recovery codes.'
    });
  } catch (error) {
    console.error('Create affiliate error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const suspendAffiliate = async (req, res) => {
  try {
    const { id } = req.params;
    
    await db.query(
      "UPDATE affiliates SET status = 'suspended', suspended_at = NOW() WHERE id = $1",
      [id]
    );
    
    res.json({ success: true, message: 'Affiliate suspended' });
  } catch (error) {
    console.error('Suspend affiliate error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const reactivateAffiliate = async (req, res) => {
  try {
    const { id } = req.params;
    
    await db.query(
      "UPDATE affiliates SET status = 'active', suspended_at = NULL WHERE id = $1",
      [id]
    );
    
    res.json({ success: true, message: 'Affiliate reactivated' });
  } catch (error) {
    console.error('Reactivate affiliate error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const regenerateAffiliateRecoveryKit = async (req, res) => {
  try {
    const { id } = req.params;
    
    const codes = [];
    for (let i = 0; i < 10; i++) {
      codes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
    }
    const hashedCodes = await Promise.all(codes.map(c => argon2.hash(c)));
    
    await db.query(
      'UPDATE affiliates SET recovery_codes_hash = $1 WHERE id = $2',
      [JSON.stringify(hashedCodes), id]
    );
    
    res.json({
      success: true,
      data: { recoveryCodes: codes },
      message: 'Recovery kit regenerated. Old codes are invalidated.'
    });
  } catch (error) {
    console.error('Regenerate recovery kit error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ============ REFERRAL TRACKING ============

const getReferrals = async (req, res) => {
  try {
    const { affiliateId, status, plan, startDate, endDate, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    let query = `
      SELECT r.id, r.plan, r.amount_cents, r.transaction_date, r.status, r.created_at,
             a.username as affiliate_username, al.code as affiliate_code
       FROM referrals r
       JOIN affiliates a ON r.affiliate_id = a.id
       LEFT JOIN affiliate_links al ON r.affiliate_link_id = al.id
       WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 1;
    
    if (affiliateId) {
      query += ` AND r.affiliate_id = $${paramCount}`;
      params.push(affiliateId);
      paramCount++;
    }
    if (status) {
      query += ` AND r.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }
    if (plan) {
      query += ` AND r.plan ILIKE $${paramCount}`;
      params.push(`%${plan}%`);
      paramCount++;
    }
    if (startDate) {
      query += ` AND r.created_at >= $${paramCount}`;
      params.push(startDate);
      paramCount++;
    }
    if (endDate) {
      query += ` AND r.created_at <= $${paramCount}`;
      params.push(endDate);
      paramCount++;
    }
    
    query += ` ORDER BY r.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(parseInt(limit), offset);
    
    const result = await db.query(query, params);
    
    // Count
    let countQuery = `SELECT COUNT(*) FROM referrals r WHERE 1=1`;
    const countParams = [];
    let cp = 1;
    if (affiliateId) { countQuery += ` AND r.affiliate_id = $${cp}`; countParams.push(affiliateId); cp++; }
    if (status) { countQuery += ` AND r.status = $${cp}`; countParams.push(status); cp++; }
    if (plan) { countQuery += ` AND r.plan ILIKE $${cp}`; countParams.push(`%${plan}%`); cp++; }
    if (startDate) { countQuery += ` AND r.created_at >= $${cp}`; countParams.push(startDate); cp++; }
    if (endDate) { countQuery += ` AND r.created_at <= $${cp}`; countParams.push(endDate); cp++; }
    const countResult = await db.query(countQuery, countParams);
    
    const referrals = result.rows.map(r => ({
      ...r,
      amount: r.amount_cents / 100
    }));
    
    res.json({
      success: true,
      data: referrals,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].count),
        pages: Math.ceil(countResult.rows[0].count / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get referrals error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ============ PAYOUT MANAGEMENT ============

const getPayoutRequests = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    let query = `
      SELECT pr.id, pr.amount_cents, pr.requested_at, pr.processed_at, pr.status, pr.notes,
             a.username as affiliate_username
       FROM payout_requests pr
       JOIN affiliates a ON pr.affiliate_id = a.id
       WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 1;
    
    if (status) {
      query += ` AND pr.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }
    
    query += ` ORDER BY pr.requested_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(parseInt(limit), offset);
    
    const result = await db.query(query, params);
    
    let countQuery = `SELECT COUNT(*) FROM payout_requests pr WHERE 1=1`;
    const countParams = [];
    if (status) { countQuery += ` AND pr.status = $1`; countParams.push(status); }
    const countResult = await db.query(countQuery, countParams);
    
    const payouts = result.rows.map(p => ({
      ...p,
      amount: p.amount_cents / 100
    }));
    
    res.json({
      success: true,
      data: payouts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].count),
        pages: Math.ceil(countResult.rows[0].count / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get payout requests error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const approvePayout = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    
    // Get payout request
    const payoutResult = await db.query(
      'SELECT affiliate_id, amount_cents, status FROM payout_requests WHERE id = $1',
      [id]
    );
    
    if (payoutResult.rows.length === 0) {
      return res.status(404).json({ error: 'Payout request not found' });
    }
    
    if (payoutResult.rows[0].status !== 'pending') {
      return res.status(400).json({ error: 'Payout already processed' });
    }
    
    const { affiliate_id, amount_cents } = payoutResult.rows[0];
    
    // Update payout request
    await db.query(
      `UPDATE payout_requests SET status = 'processed', processed_at = NOW(), notes = COALESCE($1, notes) WHERE id = $2`,
      [notes || null, id]
    );
    
    // Create payout transaction
    await db.query(
      `INSERT INTO transactions (affiliate_id, type, amount_cents, description, paid_out_at)
       VALUES ($1, 'payout', $2, $3, NOW())`,
      [affiliate_id, -amount_cents, `Payout - Request #${id.slice(0, 8)}`]
    );
    
    res.json({ success: true, message: 'Payout approved and logged' });
  } catch (error) {
    console.error('Approve payout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const rejectPayout = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    
    await db.query(
      `UPDATE payout_requests SET status = 'rejected', processed_at = NOW(), notes = COALESCE($1, notes) WHERE id = $2`,
      [notes || null, id]
    );
    
    res.json({ success: true, message: 'Payout rejected' });
  } catch (error) {
    console.error('Reject payout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const logManualPayout = async (req, res) => {
  try {
    const { affiliateUsername, amount, notes } = req.body;
    
    if (!affiliateUsername || !amount) {
      return res.status(400).json({ error: 'Affiliate username and amount required' });
    }
    
    const affiliateResult = await db.query(
      'SELECT id FROM affiliates WHERE username = $1',
      [affiliateUsername]
    );
    
    if (affiliateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Affiliate not found' });
    }
    
    const amountCents = Math.round(amount * 100);
    
    // Create payout request (already processed)
    const payoutResult = await db.query(
      `INSERT INTO payout_requests (affiliate_id, amount_cents, status, processed_at, notes)
       VALUES ($1, $2, 'processed', NOW(), $3)
       RETURNING id`,
      [affiliateResult.rows[0].id, amountCents, notes || '']
    );
    
    // Create payout transaction
    await db.query(
      `INSERT INTO transactions (affiliate_id, type, amount_cents, description, paid_out_at, payout_request_id)
       VALUES ($1, 'payout', $2, $3, NOW(), $4)`,
      [affiliateResult.rows[0].id, -amountCents, `Manual payout - ${notes || ''}`, payoutResult.rows[0].id]
    );
    
    res.json({ success: true, message: 'Manual payout logged successfully' });
  } catch (error) {
    console.error('Log manual payout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ============ SYSTEM SETTINGS ============

const getSettings = async (req, res) => {
  try {
    const configResult = await db.query('SELECT * FROM payout_config LIMIT 1');
    const config = configResult.rows[0];
    
    res.json({
      success: true,
      data: {
        minimumPayout: config ? (parseInt(config.minimum_payout_cents || config.minimum_payout) || 1000) / 100 : 10,
        commissionRateMonthly: config ? parseFloat(config.commission_rate_monthly) || 0.10 : 0.10,
        commissionRateQuarterly: config ? parseFloat(config.commission_rate_quarterly) || 0.10 : 0.10,
        commissionRateSemiannual: config ? parseFloat(config.commission_rate_semiannual) || 0.10 : 0.10,
        commissionRateAnnual: config ? parseFloat(config.commission_rate_annual) || 0.10 : 0.10,
        holdPeriodDays: config ? parseInt(config.hold_period_days) || 30 : 30
      }
    });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const updateSettings = async (req, res) => {
  try {
    const { minimumPayout, commissionRateMonthly, commissionRateQuarterly, commissionRateSemiannual, commissionRateAnnual, holdPeriodDays } = req.body;
    
    await db.query(`
      INSERT INTO payout_config (id, minimum_payout, commission_rate_monthly, commission_rate_quarterly,
                                  commission_rate_semiannual, commission_rate_annual, hold_period_days)
      VALUES (1, $1, $2, $3, $4, $5, $6)
      ON CONFLICT (id) DO UPDATE SET
        minimum_payout = EXCLUDED.minimum_payout,
        commission_rate_monthly = EXCLUDED.commission_rate_monthly,
        commission_rate_quarterly = EXCLUDED.commission_rate_quarterly,
        commission_rate_semiannual = EXCLUDED.commission_rate_semiannual,
        commission_rate_annual = EXCLUDED.commission_rate_annual,
        hold_period_days = EXCLUDED.hold_period_days
    `, [
      Math.round((minimumPayout || 50) * 100),
      commissionRateMonthly || 0.10,
      commissionRateQuarterly || 0.10,
      commissionRateSemiannual || 0.10,
      commissionRateAnnual || 0.10,
      holdPeriodDays || 30
    ]);
    
    res.json({ success: true, message: 'Settings updated' });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};


// ============ AFFILIATE PASSWORD RESET ============

const resetAffiliatePassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const passwordHash = await argon2.hash(password);

    await db.query(
      'UPDATE affiliates SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [passwordHash, id]
    );

    await db.query(
      `INSERT INTO audit_events (actor_type, actor_id, action, target_type, target_id, created_at)
       VALUES ('admin', $1, 'reset_affiliate_password', 'affiliate', $2, NOW())`,
      [req.user?.id || 'unknown', id]
    );

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    console.error('Reset affiliate password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};


// ============ TAX TRANSACTIONS ============

const getTaxTransactions = async (req, res) => {
  try {
    const { start_date, end_date, state } = req.query;

    let query = `
      SELECT
        id,
        transaction_date,
        postal_code,
        country,
        state,
        base_charge_cents,
        tax_rate,
        tax_amount_cents,
        total_amount_cents,
        invoice_number,
        subscription_id,
        created_at
      FROM tax_transactions
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 0;

    if (start_date) {
      paramCount++;
      query += ` AND transaction_date::date >= $${paramCount}`;
      params.push(start_date);
    }
    if (end_date) {
      paramCount++;
      query += ` AND transaction_date::date <= $${paramCount}`;
      params.push(end_date);
    }
    if (state) {
      paramCount++;
      query += ` AND UPPER(COALESCE(state, '')) = UPPER($${paramCount})`;
      params.push(state);
    }

    query += ` ORDER BY transaction_date DESC LIMIT 1000`;

    const { rows } = await db.query(query, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('GetTaxTransactions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getTaxSummary = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    let query = `
      SELECT
        COALESCE(UPPER(state), 'UNKNOWN') AS state,
        COUNT(*) AS total_transactions,
        SUM(base_charge_cents) AS total_base_cents,
        SUM(tax_amount_cents) AS total_tax_cents
      FROM tax_transactions
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 0;

    if (start_date) {
      paramCount++;
      query += ` AND transaction_date::date >= $${paramCount}`;
      params.push(start_date);
    }
    if (end_date) {
      paramCount++;
      query += ` AND transaction_date::date <= $${paramCount}`;
      params.push(end_date);
    }

    query += ` GROUP BY COALESCE(UPPER(state), 'UNKNOWN') ORDER BY total_tax_cents DESC`;

    const { rows } = await db.query(query, params);

    const totalBase = rows.reduce((sum, r) => sum + Number(r.total_base_cents || 0), 0);
    const totalTax = rows.reduce((sum, r) => sum + Number(r.total_tax_cents || 0), 0);
    const totalTxns = rows.reduce((sum, r) => sum + Number(r.total_transactions || 0), 0);

    const byState = {};
    rows.forEach(r => {
      byState[r.state] = {
        total_transactions: Number(r.total_transactions),
        total_base_cents: Number(r.total_base_cents),
        total_tax_cents: Number(r.total_tax_cents)
      };
    });

    res.json({
      success: true,
      data: {
        totalTransactions: totalTxns,
        totalBaseRevenueCents: totalBase,
        totalTaxCents: totalTax,
        byState
      }
    });
  } catch (error) {
    console.error('GetTaxSummary error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const exportTaxTransactionsCSV = async (req, res) => {
  try {
    const { start_date, end_date, state } = req.query;

    let query = `
      SELECT
        TO_CHAR(transaction_date, 'YYYY-MM-DD') AS date,
        invoice_number AS invoice,
        postal_code AS "Postal Code",
        COALESCE(country, 'US') AS country,
        COALESCE(state, 'N/A') AS state,
        ROUND(CAST(base_charge_cents AS numeric) / 100, 2) AS "Base Charge ($)",
        tax_rate AS "Tax Rate (%)",
        ROUND(CAST(tax_amount_cents AS numeric) / 100, 2) AS "Tax Amount ($)",
        ROUND(CAST(total_amount_cents AS numeric) / 100, 2) AS "Total Amount ($)"
      FROM tax_transactions
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 0;

    if (start_date) {
      paramCount++;
      query += ` AND transaction_date::date >= $${paramCount}`;
      params.push(start_date);
    }
    if (end_date) {
      paramCount++;
      query += ` AND transaction_date::date <= $${paramCount}`;
      params.push(end_date);
    }
    if (state) {
      paramCount++;
      query += ` AND UPPER(COALESCE(state, '')) = UPPER($${paramCount})`;
      params.push(state);
    }

    query += ` ORDER BY transaction_date DESC LIMIT 5000`;

    const { rows } = await db.query(query, params);

    const header = 'Date,Invoice,Postal Code,Country,State,Base Charge ($),Tax Rate (%),Tax Amount ($),Total Amount ($)';
    const csvRows = rows.map(r =>
      `"${r.date}","${r.invoice}","${r['Postal Code']}","${r.country}","${r.state}","${r['Base Charge ($)']}","${r['Tax Rate (%)']}","${r['Tax Amount ($)']}","${r['Total Amount ($)']}"`
    );

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="tax-transactions-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send([header, ...csvRows].join('\n'));
  } catch (error) {
    console.error('ExportTaxCSV error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};



// Admin: create affiliate code for a specific affiliate
const createAffiliateCode = async (req, res) => {
  try {
    const { affiliateId, code, discountCents } = req.body;
    
    if (!affiliateId || !code) {
      return res.status(400).json({ error: 'affiliateId and code are required' });
    }
    
    // Verify affiliate exists
    const aff = await db.query('SELECT id, username FROM affiliates WHERE id = $1', [affiliateId]);
    if (aff.rows.length === 0) {
      return res.status(404).json({ error: 'Affiliate not found' });
    }
    
    // Check code uniqueness
    const existing = await db.query('SELECT id FROM affiliate_links WHERE code = $1', [code.toUpperCase()]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Code already exists' });
    }
    
    const url = 'https://ahoyvpn.net/affiliate/' + code.toUpperCase();
    const linkResult = await db.query(
      'INSERT INTO affiliate_links (affiliate_id, code, url, active) VALUES ($1, $2, $3, true) RETURNING id, code, url, active, created_at',
      [affiliateId, code.toUpperCase(), url]
    );
    
    const linkId = linkResult.rows[0].id;
    const discount = parseInt(discountCents) || 0;
    
    if (discount > 0) {
      await db.query(
        'INSERT INTO affiliate_link_discounts (affiliate_link_id, discount_cents) VALUES ($1, $2) ON CONFLICT (affiliate_link_id) DO UPDATE SET discount_cents = $2',
        [linkId, discount]
      );
    }
    
    res.json({
      success: true,
      data: { ...linkResult.rows[0], discount_cents: discount },
      message: 'Affiliate code created'
    });
  } catch (error) {
    console.error('Create affiliate code error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Admin: get all affiliate codes with discounts
const getAffiliateCodes = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT al.id, al.affiliate_id, al.code, al.url, al.clicks, al.active, al.created_at,
             a.username as affiliate_username,
             COALESCE(ald.discount_cents, 0) as discount_cents
      FROM affiliate_links al
      JOIN affiliates a ON al.affiliate_id = a.id
      LEFT JOIN affiliate_link_discounts ald ON al.id = ald.affiliate_link_id
      ORDER BY al.created_at DESC
    `);
    
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Get affiliate codes error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Admin: update discount on an affiliate code
const updateAffiliateCodeDiscount = async (req, res) => {
  try {
    const { id } = req.params;
    const { discountCents } = req.body;
    const discount = parseInt(discountCents) || 0;
    
    await db.query(
      'INSERT INTO affiliate_link_discounts (affiliate_link_id, discount_cents) VALUES ($1, $2) ON CONFLICT (affiliate_link_id) DO UPDATE SET discount_cents = $2',
      [id, discount]
    );
    
    res.json({ success: true, message: 'Discount updated' });
  } catch (error) {
    console.error('Update affiliate code discount error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// -- Delete / Archive affiliates ---
const deleteAffiliate = async (req, res) => {
  try {
    const { id } = req.params;
    const aff = await db.query('SELECT id, username FROM affiliates WHERE id = $1', [id]);
    if (!aff.rows.length) return res.status(404).json({ error: 'Affiliate not found' });

    const active = await db.query(
      "SELECT COUNT(*) as c FROM referrals WHERE affiliate_id = $1 AND status = 'active'",
      [id]
    );
    if (parseInt(active.rows[0].c) > 0)
      return res.status(400).json({ error: 'Cannot delete affiliate with active referrals. Archive instead.' });

    const pending = await db.query(
      "SELECT COUNT(*) as c FROM payout_requests WHERE affiliate_id = $1 AND status = 'pending'",
      [id]
    );
    if (parseInt(pending.rows[0].c) > 0)
      return res.status(400).json({ error: 'Cannot delete affiliate with pending payouts. Pay or reject first.' });

    await db.query('DELETE FROM affiliates WHERE id = $1', [id]);
    res.json({ success: true, message: 'Affiliate permanently deleted' });
  } catch (error) {
    console.error('Delete affiliate error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const archiveAffiliate = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      "UPDATE affiliates SET status = 'archived', archived_at = NOW() WHERE id = $1 RETURNING id, username",
      [id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Affiliate not found' });
    res.json({ success: true, message: 'Affiliate archived', data: result.rows[0] });
  } catch (error) {
    console.error('Archive affiliate error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  createAffiliateCode,
  getAffiliateCodes,
  updateAffiliateCodeDiscount,
  adminLogin,
  adminLogout,
  getDashboardMetrics,
  getAffiliates,
  getAffiliate,
  createAffiliate,
  suspendAffiliate,
  reactivateAffiliate,
  regenerateAffiliateRecoveryKit,
  resetAffiliatePassword,
  getReferrals,
  getPayoutRequests,
  approvePayout,
  rejectPayout,
  logManualPayout,
  getSettings,
  updateSettings,
  getTaxTransactions,
  getTaxSummary,
  exportTaxTransactionsCSV,
  deleteAffiliate,
  archiveAffiliate,
};