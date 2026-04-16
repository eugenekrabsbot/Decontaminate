const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { protectAdmin, loginRateLimiter } = require('../middleware/authMiddleware_new');

// Public routes (no authentication required)
router.post('/auth/admin/login', loginRateLimiter, adminController.login);

// Protected routes (authentication required)
router.use(protectAdmin);

router.post('/auth/admin/logout', adminController.logout);
router.get('/admin/customers', adminController.getCustomers);
router.get('/admin/customers/:id', adminController.getCustomer);
router.post('/admin/customers/:id/reset-password', adminController.resetCustomerPassword);
router.post('/admin/customers/:id/rotate-recovery-kit', adminController.rotateCustomerRecoveryKit);
router.post('/admin/customers/:id/message', adminController.sendMessageToCustomer);
router.post('/admin/customers/:id/deactivate', adminController.deactivateCustomer);
router.delete('/admin/customers/:id', adminController.deleteCustomer);
router.get('/admin/affiliates', adminController.getAffiliates);
router.post('/admin/affiliates', adminController.createAffiliate);
router.get('/admin/affiliates/export/csv', adminController.exportAffiliatesCSV);
router.get('/admin/affiliates/:id/export/referrals/csv', adminController.exportAffiliateReferralsCSV);
router.get('/admin/affiliates/:id', adminController.getAffiliate);
router.post('/admin/affiliates/:id/disable', adminController.disableAffiliate);
router.post('/admin/affiliates/:id/adjust-earnings', adminController.adjustAffiliateEarnings);
router.get('/admin/kpis', adminController.getKPIs);
router.get('/admin/metrics', adminController.getAdminMetrics);
router.get('/admin/referrals', adminController.getReferralTracking);
router.post('/admin/payouts/log', adminController.logPayout);
router.get('/admin/settings', adminController.getSystemSettings);
router.put('/admin/settings', adminController.updateSystemSettings);

module.exports = router;
