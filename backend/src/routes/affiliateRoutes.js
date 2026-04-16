const express = require('express');
const router = express.Router();
const affiliateController = require('../controllers/affiliateController');
const ahoymanController = require('../controllers/ahoymanController');
const { protectAffiliate, protectAdmin, loginRateLimiter } = require('../middleware/authMiddleware_new');

// ── Public affiliate auth ─────────────────────────────────────────────────────
router.post('/auth/affiliate/login', loginRateLimiter, affiliateController.login);

// ── Admin affiliate management (requires admin JWT) ───────────────────────────
// Placed BEFORE protectAffiliate so it gets checked against admin JWT,
// not affiliate JWT (which would reject admin tokens).
router.post('/auth/ahoyman/affiliates', protectAdmin, ahoymanController.createAffiliate);

// ── Affiliate self-service (requires affiliate JWT) ───────────────────────────
router.use(protectAffiliate);

router.post('/auth/affiliate/logout', affiliateController.logout);
router.post('/affiliate/codes', affiliateController.createCode);
router.get('/affiliate/codes', affiliateController.getCodes);
router.delete('/affiliate/codes/:id', affiliateController.deleteCode);
router.post('/affiliate/generate-link', affiliateController.generateAffiliateLink);
router.get('/affiliate/metrics', affiliateController.getMetrics);
router.get('/affiliate/earnings', affiliateController.getEarnings);
router.get('/affiliate/referrals', affiliateController.getReferralPerformance);
router.get('/affiliate/payouts', affiliateController.getPayoutHistory);
router.post('/affiliate/payouts/request', affiliateController.requestPayout);
router.put('/affiliate/password', affiliateController.changePassword);
router.get('/affiliate/recovery-kit', affiliateController.getRecoveryKit);
router.post('/affiliate/recovery-kit/regenerate', affiliateController.regenerateRecoveryKit);

module.exports = router;
