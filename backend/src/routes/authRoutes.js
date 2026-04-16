const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController_csrf');
const { protect } = require('../middleware/authMiddleware');

// Public routes
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/refresh-token', authController.refreshToken);

// Protected routes (require authentication)
router.post('/logout', protect, authController.logout);

module.exports = router;
