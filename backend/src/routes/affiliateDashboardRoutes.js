const express = require('express');
const router = express.Router();
const affiliateDashboardController = require('../controllers/affiliateDashboardController');
const { protectAffiliate, csrfProtection } = require('../middleware/authMiddleware_new');

// GET /api/affiliate/metrics
router.get('/metrics', protectAffiliate, csrfProtection, affiliateDashboardController.getMetrics);

// GET /api/affiliate/links
router.get('/links', protectAffiliate, csrfProtection, affiliateDashboardController.getLinks);

// POST /api/affiliate/links
router.post('/links', protectAffiliate, csrfProtection, affiliateDashboardController.generateLink);

// GET /api/affiliate/referrals
router.get('/referrals', protectAffiliate, csrfProtection, affiliateDashboardController.getReferrals);

// GET /api/affiliate/transactions
router.get('/transactions', protectAffiliate, csrfProtection, affiliateDashboardController.getTransactions);

// GET /api/affiliate/payout-requests
router.get('/payout-requests', protectAffiliate, csrfProtection, affiliateDashboardController.getPayoutRequests);

// POST /api/affiliate/request-payout
router.post('/request-payout', protectAffiliate, csrfProtection, affiliateDashboardController.requestPayout);


// POST /api/affiliate/codes — create custom code with discount
router.post('/codes', protectAffiliate, csrfProtection, affiliateDashboardController.createCode);

// DELETE /api/affiliate/codes/:id — delete own code
router.delete('/codes/:id', protectAffiliate, csrfProtection, affiliateDashboardController.deleteCode);

module.exports = router;
