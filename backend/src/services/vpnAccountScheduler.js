const db = require('../config/database');
const VpnResellersService = require('./vpnResellersService');

const vpnResellersService = new VpnResellersService();

async function cleanupExpiredAccounts() {
  const result = await db.query(
    `SELECT id, purewl_uuid, user_id
     FROM vpn_accounts
     WHERE status = 'active' AND expiry_date <= NOW()`
  );

  for (const row of result.rows) {
    try {
      if (row.purewl_uuid) {
        await vpnResellersService.deactivateAccount({ account_id: row.purewl_uuid });
      }
    } catch (err) {
      console.warn('Failed to deactivate VPN Reseller account', row.purewl_uuid, err.message);
    }

    await db.query(
      `UPDATE vpn_accounts
       SET status = 'expired', updated_at = NOW()
       WHERE id = $1`,
      [row.id]
    );
  }
}

async function cleanupCanceledSubscriptions() {
  const result = await db.query(
    `SELECT va.id, va.purewl_uuid
     FROM vpn_accounts va
     JOIN subscriptions s ON s.user_id = va.user_id
     WHERE va.status IN ('active')
       AND s.cancel_at_period_end = true
       AND s.current_period_end <= NOW()`
  );

  for (const row of result.rows) {
    try {
      if (row.purewl_uuid) {
        await vpnResellersService.deactivateAccount({ account_id: row.purewl_uuid });
      }
    } catch (err) {
      console.warn('Failed to deactivate canceled VPN Reseller account', row.purewl_uuid, err.message);
    }

    await db.query(
      `UPDATE vpn_accounts
       SET status = 'expired', updated_at = NOW()
       WHERE id = $1`,
      [row.id]
    );
  }
}

// Suspend accounts after 30 days of trial without payment
async function suspendExpiredTrials() {
  const result = await db.query(
    `SELECT id, user_id, status, plisio_invoice_id
     FROM subscriptions
     WHERE status = 'trialing'
       AND created_at < NOW() - INTERVAL '30 days'
       AND plisio_invoice_id IS NOT NULL`
  );

  for (const row of result.rows) {
    try {
      // Update subscription to canceled
      await db.query(
        `UPDATE subscriptions
         SET status = 'canceled', updated_at = NOW()
         WHERE id = $1`,
        [row.id]
      );

      // Suspend VPN account if exists
      const vpnAccount = await db.query(
        `SELECT id, purewl_uuid FROM vpn_accounts WHERE user_id = $1 AND status = 'active'`,
        [row.user_id]
      );

      if (vpnAccount.rows.length > 0) {
        const va = vpnAccount.rows[0];
        if (va.purewl_uuid) {
          try {
            await vpnResellersService.deactivateAccount({ account_id: va.purewl_uuid });
          } catch (err) {
            console.warn('Failed to deactivate VPN account during trial expiry', va.purewl_uuid, err.message);
          }
        }
        await db.query(
          `UPDATE vpn_accounts SET status = 'suspended', updated_at = NOW() WHERE id = $1`,
          [va.id]
        );
      }

      // Mark user account inactive
      await db.query(
        `UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1`,
        [row.user_id]
      );

      console.log(`Suspended expired trial subscription ${row.id} for user ${row.user_id}`);
    } catch (err) {
      console.error('Error suspending expired trial:', row.id, err.message);
    }
  }
}

// Delete abandoned checkouts (trialing subscriptions older than 3 days with no payment)
async function cleanupAbandonedCheckouts() {
  const result = await db.query(
    `DELETE FROM subscriptions
     WHERE status = 'trialing'
       AND plisio_invoice_id IS NOT NULL
       AND created_at < NOW() - INTERVAL '3 days'
     RETURNING id, user_id, plisio_invoice_id`
  );

  if (result.rows.length > 0) {
    console.log(`Deleted ${result.rows.length} abandoned checkout subscriptions`);

    // Also delete associated pending payments
    for (const sub of result.rows) {
      await db.query(
        `DELETE FROM payments
         WHERE subscription_id = $1 AND status = 'pending'`,
        [sub.id]
      );
    }
  }
}

module.exports = {
  cleanupExpiredAccounts,
  cleanupCanceledSubscriptions,
  suspendExpiredTrials,
  cleanupAbandonedCheckouts
};
