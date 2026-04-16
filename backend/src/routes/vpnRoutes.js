const express = require('express');
const router = express.Router();
const vpnController = require('../controllers/vpnController');
const authMiddleware = require('../middleware/authMiddleware');
const { csrfProtection, setCsrfToken } = require('../middleware/authMiddleware_new');

router.use(authMiddleware.protect);
router.use(csrfProtection);

router.get('/servers', vpnController.getServers);
router.get('/config/wireguard', vpnController.getWireGuardConfig);
router.get('/config/openvpn', vpnController.getOpenVPNConfig);
router.post('/connect', vpnController.connect);
router.post('/disconnect', vpnController.disconnect);
router.get('/connections', vpnController.getConnections);

module.exports = router;