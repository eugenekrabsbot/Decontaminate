const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const exportController = require('../controllers/exportController');
const authMiddleware = require('../middleware/authMiddleware');
const { csrfProtection, setCsrfToken } = require('../middleware/authMiddleware_new');

router.use(authMiddleware.protect);
router.use(csrfProtection);

router.get('/profile', userController.getProfile);
router.put('/profile', authMiddleware.require2FA, userController.updateProfile);
router.get('/devices', userController.getDevices);
router.delete('/devices/:id', userController.revokeDevice);
router.get('/activity', userController.getActivity);
router.get('/usage', userController.getUsage);
router.delete('/account', userController.deleteAccount);

// GDPR/CCPA data export endpoints
router.post('/export', exportController.createExport);
router.get('/export/:token', exportController.downloadExport);

module.exports = router;