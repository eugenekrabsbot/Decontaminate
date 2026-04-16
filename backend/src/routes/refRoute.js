const express = require('express');
const router = express.Router();
const db = require('../config/database');

const normalizeAffiliateCode = (value) => {
  if (!value) return null;
  const normalized = String(value).trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  return normalized || null;
};

router.get('/ref/:refCode', async (req, res) => {
  try {
    const { refCode } = req.params;
    const code = normalizeAffiliateCode(refCode);
    if (!code) {
      return res.status(400).json({ error: 'Invalid referral code' });
    }

    // Look up affiliate by username (affiliates table uses username as the referral code)
    const affiliateResult = await db.query(
      `SELECT id, username, status FROM affiliates WHERE LOWER(username) = LOWER($1) LIMIT 1`,
      [code]
    );

    const affiliate = affiliateResult.rows[0];
    const affiliateUsername = affiliate ? affiliate.username : code;

    // Set JS-readable affiliate cookie for 30 days
    res.cookie('affiliate_code', affiliateUsername, {
      path: '/',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      httpOnly: false,   // Must be readable by frontend JS at checkout
      sameSite: 'Lax',
      secure: process.env.NODE_ENV === 'production'
    });

    const redirectUrl = req.query.redirect || '/';
    return res.redirect(redirectUrl);

  } catch (error) {
    console.error('Ref click error:', error);
    return res.redirect('/');
  }
});

module.exports = router;
