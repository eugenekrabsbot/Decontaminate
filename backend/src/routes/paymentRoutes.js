const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const webhookController = require('../controllers/webhookController');

// ═══════════════════════════════════════════════════════════
// PUBLIC ENDPOINTS — no authentication required
// ═══════════════════════════════════════════════════════════

// Webhook endpoints
router.post('/webhook/authorize', webhookController.authorizeNetWebhook);
router.post('/webhook/paymentscloud', webhookController.paymentsCloudWebhook);

// Hosted payment bridge
router.get('/hosted-redirect-script.js', paymentController.hostedRedirectScript);
router.get('/hosted-redirect', paymentController.hostedRedirectBridge);

// Authorize relay response (public return from hosted payment page)
router.get('/authorize/relay', paymentController.authorizeRelayResponse);
router.post('/authorize/relay', paymentController.authorizeRelayResponse);

// Invoice status (public callback from Plisio)
router.get('/invoice/:invoiceId/status', paymentController.getInvoiceStatus);

// ═══════════════════════════════════════════════════════════
// AUTHENTICATED ENDPOINTS — require valid JWT via allowInactive
// ═══════════════════════════════════════════════════════════

const { allowInactive } = require('../middleware/authMiddleware');
router.use(allowInactive);

router.get('/plans', paymentController.getPlans);
router.post('/checkout', paymentController.createCheckout);

module.exports = router;