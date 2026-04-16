const argon2 = require('argon2');
const crypto = require('crypto');
const db = require('../config/database');

// Get affiliate dashboard metrics
const getMetrics = async (req, res) => {
  try {
    const affiliateId = req.affiliateId;
    
    // Get totals — aggregate each table separately to avoid cartesian join inflation
    const txResult = await db.query(
      `SELECT
        COALESCE(SUM(CASE WHEN type = 'commission' THEN amount_cents ELSE 0 END), 0) as total_earned_cents,
        COALESCE(SUM(CASE WHEN type = 'payout' THEN ABS(amount_cents) ELSE 0 END), 0) as total_paid_cents,
        COALESCE(SUM(CASE WHEN type = 'commission' AND paid_out_at IS NULL THEN amount_cents ELSE 0 END), 0) as pending_cents
       FROM transactions
       WHERE affiliate_id = $1`,
      [affiliateId]
    );
    
    const refResult = await db.query(
      `SELECT
        COALESCE(COUNT(DISTINCT id), 0) as total_referrals,
        COALESCE(COUNT(DISTINCT CASE WHEN status = 'active' THEN id END), 0) as active_referrals
       FROM referrals
       WHERE affiliate_id = $1`,
      [affiliateId]
    );
    
    // Get signups this month
    const monthResult = await db.query(
      `SELECT COUNT(*) as this_month
       FROM referrals
       WHERE affiliate_id = $1
       AND created_at >= DATE_TRUNC('month', NOW())`,
      [affiliateId]
    );
    
    // Get available to cash out (pending - hold)
    const pendingCents = parseInt(txResult.rows[0].pending_cents) || 0;
    
    // Hold period: 30 days from transaction
    const holdResult = await db.query(
      `SELECT COALESCE(SUM(amount_cents), 0) as held_cents
       FROM transactions
       WHERE affiliate_id = $1
       AND type = 'commission'
       AND paid_out_at IS NULL
       AND created_at > NOW() - INTERVAL '30 days'`,
      [affiliateId]
    );
    
    const heldCents = parseInt(holdResult.rows[0].held_cents) || 0;
    const availableCents = Math.max(0, pendingCents - heldCents);
    const refs = refResult.rows[0];
    
    res.json({
      success: true,
      data: {
        totalSignups: parseInt(refs.total_referrals) || 0,
        signupsThisMonth: parseInt(monthResult.rows[0].this_month) || 0,
        activeReferrals: parseInt(refs.active_referrals) || 0,
        totalEarned: (parseInt(txResult.rows[0].total_earned_cents) || 0) / 100,
        pendingPayout: pendingCents / 100,
        availableToCashOut: availableCents / 100,
        heldAmount: heldCents / 100
      }
    });
  } catch (error) {
    console.error('Get affiliate metrics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get affiliate links
const getLinks = async (req, res) => {
  try {
    const linksResult = await db.query(
      `SELECT al.id, al.code, al.url, al.clicks, al.created_at, al.active,
             COALESCE(ald.discount_cents, 0) as discount_cents
       FROM affiliate_links al
       LEFT JOIN affiliate_link_discounts ald ON al.id = ald.affiliate_link_id
       WHERE al.affiliate_id = $1
       ORDER BY al.created_at DESC`,
      [req.affiliateId]
    );
    
    // Get signups per link
    const signupsResult = await db.query(
      `SELECT referral_link_id, COUNT(*) as signups
       FROM referrals
       WHERE affiliate_id = $1
       GROUP BY referral_link_id`,
      [req.affiliateId]
    );
    
    const signupsMap = {};
    signupsResult.rows.forEach(row => {
      signupsMap[row.referral_link_id] = parseInt(row.signups);
    });
    
    const links = linksResult.rows.map(link => ({
      ...link,
      signups: signupsMap[link.id] || 0
    }));
    
    res.json({
      success: true,
      data: links
    });
  } catch (error) {
    console.error('Get affiliate links error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Generate new affiliate link
const generateLink = async (req, res) => {
  try {
    const { customCode } = req.body;
    
    // Generate code
    let code;
    if (customCode) {
      // Check if custom code is available
      const existing = await db.query(
        'SELECT id FROM affiliate_links WHERE code = $1',
        [customCode.toUpperCase()]
      );
      if (existing.rows.length > 0) {
        return res.status(400).json({ error: 'Code already in use' });
      }
      code = customCode.toUpperCase();
    } else {
      // Generate random 8-char code
      code = crypto.randomBytes(4).toString('hex').toUpperCase();
      // Ensure unique
      let attempts = 0;
      while (attempts < 10) {
        const existing = await db.query(
          'SELECT id FROM affiliate_links WHERE code = $1',
          [code]
        );
        if (existing.rows.length === 0) break;
        code = crypto.randomBytes(4).toString('hex').toUpperCase();
        attempts++;
      }
    }
    
    const url = `https://ahoyvpn.net/affiliate/${code}`;
    
    const linkResult = await db.query(
      `INSERT INTO affiliate_links (affiliate_id, code, url)
       VALUES ($1, $2, $3)
       RETURNING id, code, url, clicks, created_at, active`,
      [req.affiliateId, code, url]
    );
    
    res.json({
      success: true,
      data: { ...linkResult.rows[0], signups: 0 }
    });
  } catch (error) {
    console.error('Generate link error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get referral performance
const getReferrals = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    const referralsResult = await db.query(
      `SELECT r.id, r.plan, r.amount_cents, r.transaction_date, r.status, r.created_at,
              al.code as link_code
       FROM referrals r
       LEFT JOIN affiliate_links al ON r.referral_link_id = al.id
       WHERE r.affiliate_id = $1
       ORDER BY r.created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.affiliateId, parseInt(limit), offset]
    );
    
    const countResult = await db.query(
      'SELECT COUNT(*) as count FROM referrals WHERE affiliate_id = $1',
      [req.affiliateId]
    );
    
    const referrals = referralsResult.rows.map(r => ({
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

// Get transaction history
const getTransactions = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    const transactionsResult = await db.query(
      `SELECT id, type, amount_cents, description, created_at, paid_out_at
       FROM transactions
       WHERE affiliate_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.affiliateId, parseInt(limit), offset]
    );
    
    const countResult = await db.query(
      'SELECT COUNT(*) as count FROM transactions WHERE affiliate_id = $1',
      [req.affiliateId]
    );
    
    const transactions = transactionsResult.rows.map(t => ({
      ...t,
      amount: t.amount_cents / 100
    }));
    
    res.json({
      success: true,
      data: transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].count),
        pages: Math.ceil(countResult.rows[0].count / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get payout requests
const getPayoutRequests = async (req, res) => {
  try {
    const payoutsResult = await db.query(
      `SELECT id, amount_cents, requested_at, processed_at, status, notes
       FROM payout_requests
       WHERE affiliate_id = $1
       ORDER BY requested_at DESC`,
      [req.affiliateId]
    );
    
    const payouts = payoutsResult.rows.map(p => ({
      ...p,
      amount: p.amount_cents / 100
    }));
    
    res.json({
      success: true,
      data: payouts
    });
  } catch (error) {
    console.error('Get payout requests error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Request payout
const requestPayout = async (req, res) => {
  try {
    const { amount } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than 0' });
    }
    
    const amountCents = Math.round(amount * 100);
    const minimumPayout = parseInt(process.env.MIN_PAYOUT_CENTS) || 1000; // default $10 from DB
    
    if (amountCents < minimumPayout) {
      return res.status(400).json({ error: `Minimum payout is $${minimumPayout / 100}` });
    }
    
    // Check available balance
    const balanceResult = await db.query(
      `SELECT COALESCE(SUM(CASE WHEN type = 'commission' THEN amount_cents ELSE 0 END), 0) -
              COALESCE(SUM(CASE WHEN type = 'payout' THEN ABS(amount_cents) ELSE 0 END), 0) as available_cents
       FROM transactions
       WHERE affiliate_id = $1`,
      [req.affiliateId]
    );
    
    const availableCents = parseInt(balanceResult.rows[0].available_cents) || 0;
    
    if (amountCents > availableCents) {
      return res.status(400).json({ error: 'Amount exceeds available balance' });
    }
    
    // Create payout request
    const payoutResult = await db.query(
      `INSERT INTO payout_requests (affiliate_id, amount_cents, status, requested_at)
       VALUES ($1, $2, 'pending', NOW())
       RETURNING id, amount_cents, requested_at, status`,
      [req.affiliateId, amountCents]
    );
    
    res.json({
      success: true,
      data: { ...payoutResult.rows[0], amount: payoutResult.rows[0].amount_cents / 100 },
      message: 'Payout request submitted. Email Ahoyvpn@ahoyvpn.net to complete.'
    });
  } catch (error) {
    console.error('Request payout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};


// Affiliate: create custom code with optional discount
const createCode = async (req, res) => {
  try {
    const { code, discountCents } = req.body;
    if (!code || code.length < 3 || code.length > 20) {
      return res.status(400).json({ error: 'Code must be 3-20 characters' });
    }
    
    // Check uniqueness
    const existing = await db.query('SELECT id FROM affiliate_links WHERE code = $1', [code.toUpperCase()]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Code already exists' });
    }
    
    // Validate discount (only 0, 25, or 50 cents allowed)
    const discount = parseInt(discountCents) || 0;
    if (![0, 25, 50].includes(discount)) {
      return res.status(400).json({ error: 'Discount must be None, $0.25, or $0.50' });
    }
    
    const url = 'https://ahoyvpn.net/affiliate/' + code.toUpperCase();
    const linkResult = await db.query(
      'INSERT INTO affiliate_links (affiliate_id, code, url, active) VALUES ($1, $2, $3, true) RETURNING id, code, url, clicks, active, created_at',
      [req.affiliateId, code.toUpperCase(), url]
    );
    
    const linkId = linkResult.rows[0].id;
    if (discount > 0) {
      await db.query(
        'INSERT INTO affiliate_link_discounts (affiliate_link_id, discount_cents) VALUES ($1, $2) ON CONFLICT (affiliate_link_id) DO UPDATE SET discount_cents = $2',
        [linkId, discount]
      );
    }
    
    res.json({
      success: true,
      data: { ...linkResult.rows[0], discount_cents: discount, signups: 0 }
    });
  } catch (error) {
    console.error('Create affiliate code error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Affiliate: delete own code
const deleteCode = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verify ownership
    const link = await db.query('SELECT id FROM affiliate_links WHERE id = $1 AND affiliate_id = $2', [id, req.affiliateId]);
    if (link.rows.length === 0) {
      return res.status(404).json({ error: 'Link not found' });
    }
    
    // Delete discount first (FK constraint)
    await db.query('DELETE FROM affiliate_link_discounts WHERE affiliate_link_id = $1', [id]);
    await db.query('DELETE FROM affiliate_links WHERE id = $1 AND affiliate_id = $2', [id, req.affiliateId]);
    
    res.json({ success: true, message: 'Link deleted' });
  } catch (error) {
    console.error('Delete affiliate code error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  createCode,
  deleteCode,
  getMetrics,
  getLinks,
  generateLink,
  getReferrals,
  getTransactions,
  getPayoutRequests,
  requestPayout
};
