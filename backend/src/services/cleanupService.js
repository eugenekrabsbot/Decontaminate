const exportController = require('../controllers/exportController');
const AuditLog = require('../models/auditLogModel');
const db = require('../config/database');

/**
 * Run cleanup of expired data exports.
 */
const cleanupDataExports = async () => {
  console.log('Starting cleanup of expired data exports...');
  await exportController.cleanupExpiredExports();
};

/**
 * Delete old audit logs (retention policy).
 */
const cleanupOldAuditLogs = async () => {
  const deletedCount = await AuditLog.deleteOld(365);
  console.log(`Deleted ${deletedCount} old audit logs`);
};

/**
 * Delete old connections (VPN usage logs) — no-logs policy.
 */
const cleanupOldConnections = async () => {
  const result = await db.query(
    `DELETE FROM connections WHERE connected_at < NOW() - INTERVAL '7 days'`
  );
  console.log(`Deleted ${result.rowCount} old connection records`);
};

/**
 * Delete abandoned checkout subscriptions (trialing > 3 days, no payment).
 */
const cleanupAbandonedCheckouts = async () => {
  const { cleanupAbandonedCheckouts } = require('./vpnAccountScheduler');
  console.log('Starting abandoned checkout cleanup...');
  await cleanupAbandonedCheckouts();
};

/**
 * Suspend accounts that have been in trial for 30+ days without payment.
 */
const suspendExpiredTrials = async () => {
  const { suspendExpiredTrials } = require('./vpnAccountScheduler');
  console.log('Starting expired trial suspension...');
  await suspendExpiredTrials();
};

/**
 * Main cleanup task that runs all cleanup routines.
 */
const runAllCleanup = async () => {
  try {
    await cleanupDataExports();
    await cleanupOldAuditLogs();
    await cleanupOldConnections();
    await cleanupAbandonedCheckouts();
    await suspendExpiredTrials();
    console.log('All cleanup tasks completed.');
  } catch (error) {
    console.error('Cleanup task error:', error);
  }
};

module.exports = {
  cleanupDataExports,
  cleanupOldAuditLogs,
  cleanupOldConnections,
  cleanupAbandonedCheckouts,
  suspendExpiredTrials,
  runAllCleanup,
};
