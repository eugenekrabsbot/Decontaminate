const express = require('express');
const router = express.Router();
const ahoymanController = require('../controllers/ahoymanController');
const { protectAdmin } = require('../middleware/authMiddleware_new');

// POST /api/auth/ahoyman/login
router.post('/login', ahoymanController.adminLogin);

// POST /api/auth/ahoyman/logout
router.post('/logout', ahoymanController.adminLogout);

// GET /api/admin/metrics
router.get('/metrics', protectAdmin, ahoymanController.getDashboardMetrics);

// GET /api/admin/affiliates
router.get('/affiliates', protectAdmin, ahoymanController.getAffiliates);

// GET /api/admin/affiliates/:id
router.get('/affiliates/:id', protectAdmin, ahoymanController.getAffiliate);

// POST /api/admin/affiliates
router.post('/affiliates', protectAdmin, ahoymanController.createAffiliate);

// PUT /api/admin/affiliates/:id/suspend
router.put('/affiliates/:id/suspend', protectAdmin, ahoymanController.suspendAffiliate);

// PUT /api/admin/affiliates/:id/reactivate
router.put('/affiliates/:id/reactivate', protectAdmin, ahoymanController.reactivateAffiliate);

// POST /api/admin/affiliates/:id/regenerate-kit
router.post('/affiliates/:id/regenerate-kit', protectAdmin, ahoymanController.regenerateAffiliateRecoveryKit);

// POST /api/admin/affiliates/:id/reset-password
router.post('/affiliates/:id/reset-password', protectAdmin, ahoymanController.resetAffiliatePassword);

// GET /api/admin/referrals
router.get('/referrals', protectAdmin, ahoymanController.getReferrals);

// GET /api/admin/payout-requests
router.get('/payout-requests', protectAdmin, ahoymanController.getPayoutRequests);

// PUT /api/admin/payout-requests/:id/approve
router.put('/payout-requests/:id/approve', protectAdmin, ahoymanController.approvePayout);

// PUT /api/admin/payout-requests/:id/reject
router.put('/payout-requests/:id/reject', protectAdmin, ahoymanController.rejectPayout);

// POST /api/admin/payouts/manual
router.post('/payouts/manual', protectAdmin, ahoymanController.logManualPayout);

// GET /api/admin/settings
router.get('/settings', protectAdmin, ahoymanController.getSettings);

// PUT /api/admin/settings
router.put('/settings', protectAdmin, ahoymanController.updateSettings);

// Tax transactions routes
router.get('/tax-transactions', protectAdmin, ahoymanController.getTaxTransactions);
router.get('/tax-transactions/summary', protectAdmin, ahoymanController.getTaxSummary);
router.get('/tax-transactions/export/csv', protectAdmin, ahoymanController.exportTaxTransactionsCSV);


// Affiliate code management
router.get('/affiliate-codes', protectAdmin, ahoymanController.getAffiliateCodes);
router.post('/affiliate-codes', protectAdmin, ahoymanController.createAffiliateCode);
router.put('/affiliate-codes/:id/discount', protectAdmin, ahoymanController.updateAffiliateCodeDiscount);

// DELETE /api/admin/affiliates/:id -- permanent delete
router.delete('/affiliates/:id', protectAdmin, ahoymanController.deleteAffiliate);

// PUT /api/admin/affiliates/:id/archive -- soft delete (sets archived_at)
router.put('/affiliates/:id/archive', protectAdmin, ahoymanController.archiveAffiliate);

module.exports = router;
