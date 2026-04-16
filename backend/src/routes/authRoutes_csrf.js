const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { protect, csrfProtection } = require('../middleware/authMiddleware_new');

// Public routes (no CSRF protection needed)
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/refresh-token', authController.refreshToken);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.post('/verify-email', authController.verifyEmail);

// 2FA verification during login (public)
router.post('/2fa/verify-login', authController.verify2FALogin);

// Protected routes (require authentication + CSRF protection)
router.post('/logout', protect, csrfProtection, authController.logout);
router.post('/2fa/enable', protect, csrfProtection, authController.enable2FA);
router.post('/2fa/verify', protect, csrfProtection, authController.verify2FA);
router.post('/2fa/disable', protect, csrfProtection, authController.disable2FA);
router.post('/recovery-codes/generate', protect, csrfProtection, authController.generateNewRecoveryCodes);
router.post('/recovery-codes/verify', authController.verifyRecoveryCode); // public but needs email

module.exports = router;