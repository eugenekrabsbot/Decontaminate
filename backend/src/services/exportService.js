const db = require('../config/database');

const BLOCKED_EXPORT_FIELDS = new Set([
  'id',
  'user_id',
  'password_hash',
  'numeric_password_hash',
  'salt',
  'totp_secret',
  'recovery_codes',
  'kit_hash',
  'password_reset_token',
  'password_reset_expires',
  'email_verify_token',
  'email_verify_expires',
  'refresh_token',
  'access_token',
  'csrf_token',
  'claim_token_hash',
  'stripe_customer_id',
  'plisio_customer_id',
  'last_2fa_verification',
  'backup_codes_generated_at',
  'force_password_change',
  'purewl_password',
  'purewl_uuid',
  'ip',
  'file_path',
  'filepath',
  'token'
]);

const BLOCKED_EXPORT_PATTERNS = [
  /password/i,
  /hash/i,
  /secret/i,
  /token/i,
  /signature/i,
  /csrf/i,
  /refresh/i,
  /access/i,
  /claim/i,
  /recovery/i,
  /file.?path/i,
  /^ip$/i
];

const sanitizeForUserExport = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeForUserExport(item))
      .filter((item) => item !== undefined);
  }

  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, v] of Object.entries(value)) {
      const lower = String(key).toLowerCase();
      if (BLOCKED_EXPORT_FIELDS.has(lower)) continue;
      if (BLOCKED_EXPORT_PATTERNS.some((pattern) => pattern.test(key))) continue;

      const sanitized = sanitizeForUserExport(v);
      if (sanitized !== undefined) {
        out[key] = sanitized;
      }
    }
    return out;
  }

  return value;
};

/**
 * Gather all personal data for a given user ID.
 * Returns an object with keys for each data category.
 */
const gatherUserData = async (userId) => {
  // Ensure userId is a valid UUID
  if (!userId || typeof userId !== 'string') {
    throw new Error('Invalid user ID');
  }

  // Fetch user profile data (exclude internal auth/secrets)
  const user = await db.query(
    `SELECT
      account_number,
      email,
      created_at,
      updated_at,
      last_login,
      is_active,
      email_verified,
      trial_ends_at,
      pause_until,
      cancel_at_period_end,
      is_affiliate
     FROM users
     WHERE id = $1`,
    [userId]
  );
  const userData = user.rows[0] || {};

  // Fetch subscriptions
  const subscriptions = await db.query(
    'SELECT * FROM subscriptions WHERE user_id = $1 ORDER BY created_at',
    [userId]
  );

  // Fetch payments
  const payments = await db.query(
    'SELECT * FROM payments WHERE user_id = $1 ORDER BY created_at',
    [userId]
  );

  // Fetch VPN account
  const vpnAccount = await db.query(
    'SELECT * FROM vpn_accounts WHERE user_id = $1',
    [userId]
  );

  // Fetch devices
  const devices = await db.query(
    'SELECT * FROM devices WHERE user_id = $1 ORDER BY created_at',
    [userId]
  );

  // Fetch connections (VPN usage logs)
  const connections = await db.query(
    'SELECT * FROM connections WHERE user_id = $1 ORDER BY connected_at',
    [userId]
  );

  // Fetch affiliate info (if any)
  const affiliate = await db.query(
    'SELECT * FROM affiliates WHERE user_id = $1',
    [userId]
  );

  // Fetch referrals where user is affiliate
  let referralsAsAffiliate = [];
  if (affiliate.rows.length > 0) {
    referralsAsAffiliate = await db.query(
      'SELECT * FROM referrals WHERE affiliate_id = $1',
      [affiliate.rows[0].id]
    );
  }

  // Fetch referrals where user is referred (referred_user_id)
  const referralAsReferred = await db.query(
    'SELECT * FROM referrals WHERE referred_user_id = $1',
    [userId]
  );

  // Fetch support tickets
  const supportTickets = await db.query(
    'SELECT * FROM support_tickets WHERE user_id = $1 ORDER BY created_at',
    [userId]
  );

  // Fetch audit logs (minimal user-facing view)
  const auditLogs = await db.query(
    'SELECT action, created_at, metadata FROM audit_logs WHERE user_id = $1 ORDER BY created_at',
    [userId]
  );

  // Compile into a single object
  return {
    user: userData,
    subscriptions: subscriptions.rows,
    payments: payments.rows,
    vpnAccount: vpnAccount.rows,
    devices: devices.rows,
    connections: connections.rows,
    affiliate: affiliate.rows,
    referralsAsAffiliate: referralsAsAffiliate.rows || [],
    referralAsReferred: referralAsReferred.rows,
    supportTickets: supportTickets.rows,
    auditLogs: auditLogs.rows,
    exportDate: new Date().toISOString(),
    exportVersion: '1.0'
  };
};

/**
 * Redact sensitive fields from user data (optional)
 * This function can be used to mask or remove fields before returning to the user.
 */
const redactSensitiveFields = (data) => {
  // Clone to avoid mutating original
  const cloned = JSON.parse(JSON.stringify(data));
  const redacted = sanitizeForUserExport(cloned);

  // Keep audit logs human-readable and minimal.
  if (Array.isArray(redacted.auditLogs)) {
    redacted.auditLogs = redacted.auditLogs.map((entry) => ({
      action: entry.action,
      created_at: entry.created_at,
      metadata: entry.metadata && Object.keys(entry.metadata).length > 0 ? entry.metadata : undefined
    }));
  }

  redacted.exportVersion = '1.1';
  return redacted;
};

module.exports = {
  gatherUserData,
  redactSensitiveFields,
};