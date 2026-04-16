const express = require('express');
const router = express.Router();
const supportController = require('../controllers/supportController');
const authMiddleware = require('../middleware/authMiddleware');
const { csrfProtection, setCsrfToken } = require('../middleware/authMiddleware_new');

router.use(authMiddleware.protect);
router.use(csrfProtection);

router.post('/tickets', supportController.createTicket);
router.get('/tickets', supportController.getTickets);
router.post('/tickets/:id/reply', supportController.replyToTicket);
router.get('/kb', supportController.getKnowledgeBase);

module.exports = router;