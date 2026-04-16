const express = require('express');
const router = express.Router();
const affiliateAuthController = require('../controllers/affiliateAuthController');
const { protectAffiliate, csrfProtection, loginRateLimiter, setCsrfTokenCookie, resetTokenProtect } = require('../middleware/authMiddleware_new');

// POST /api/auth/affiliate/login
router.post('/login', loginRateLimiter, affiliateAuthController.login);

// POST /api/auth/affiliate/logout
router.post('/logout', affiliateAuthController.logout);

// POST /api/auth/affiliate/forgot-password
router.post('/forgot-password', affiliateAuthController.validateRecoveryCode);

// POST /api/auth/affiliate/reset-password
router.post('/reset-password', resetTokenProtect, affiliateAuthController.resetPassword);

// POST /api/auth/affiliate/regenerate-kit
router.post('/regenerate-kit', protectAffiliate, csrfProtection, affiliateAuthController.generateRecoveryKit);

// GET /api/auth/affiliate/profile
router.get('/profile', protectAffiliate, affiliateAuthController.getProfile);

// POST /api/auth/affiliate/change-password
router.post('/change-password', protectAffiliate, csrfProtection, affiliateAuthController.changePassword);

module.exports = router;
