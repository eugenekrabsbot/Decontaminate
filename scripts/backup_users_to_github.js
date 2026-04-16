#!/usr/bin/env node
/**
 * backup_users.js — Expanded Auth & Transaction Backup
 * Runs every 3 hours via cron.
 * Backs up all critical auth tables + transaction data to KeepUsAlive repo.
 *
 * Tier 1 (Auth — most critical):
 *   users, subscriptions, admin_users, affiliates, sessions,
 *   recovery_kits, transactions, credential_claims,
 *   password_reset_tokens, email_verify_tokens
 *
 * Tier 2 (Business data):
 *   affiliate_links, affiliate_link_discounts, payout_requests,
 *   payout_config, plans, payments, tax_transactions,
 *   admin_audit_log, audit_logs
 *
 * Retention: 30 days (was 7)
 * Cron: 0 0,3,6,9,12,15,18,21 * * * cd /home/ahoy/BackEnd && NODE_PATH=/home/ahoy/BackEnd/node_modules node backup_users.js >> /home/ahoy/backups/backup.log 2>&1
 */

const { Pool } = require('pg');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const POOL = new Pool({
  connectionString: 'postgresql://ahoyvpn:ahoyvpn_secure_password@localhost:5432/ahoyvpn',
});

const BACKUP_DIR = '/home/ahoy/backups';
const GITHUB_REMOTE = 'https://github.com/eugenekrabsbot/KeepUsAlive.git';
const BACKUP_BRANCH = 'main';
const RETENTION_DAYS = 30;

function log(msg, type = 'INFO') {
  const ts = new Date().toISOString();
  const icon = type === 'ERROR' ? '❌' : type === 'WARN' ? '⚠️' : type === 'OK' ? '✅' : '  ';
  console.log(`${icon} [${ts}] ${msg}`);
}

// ─── Single-table exporter ────────────────────────────────────────────────────

async function exportOne(client, table, columns = '*') {
  try {
    const result = await client.query(`SELECT ${columns} FROM ${table}`);
    return { [table]: { count: result.rowCount, rows: result.rows } };
  } catch (err) {
    log(`Export ${table} failed: ${err.message}`, 'WARN');
    return { [table]: { count: 0, rows: [], error: err.message } };
  }
}

// ─── Custom queries (JOINs / special cases) ────────────────────────────────────

async function exportSubscriptions(client) {
  try {
    const result = await client.query(`
      SELECT
        s.id, s.user_id, s.status, s.plan_id,
        s.current_period_start, s.current_period_end,
        s.cancel_at_period_end, s.created_at,
        u.email, u.account_number
      FROM subscriptions s
      JOIN users u ON s.user_id = u.id
      ORDER BY s.created_at DESC
    `);
    return { subscriptions: { count: result.rowCount, rows: result.rows } };
  } catch (err) {
    log(`Export subscriptions failed: ${err.message}`, 'WARN');
    return { subscriptions: { count: 0, rows: [], error: err.message } };
  }
}

// ─── MAIN ──────────────────────────────────────────────────────────────────────

async function main() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  log('Starting expanded auth data backup...');

  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    if (!fs.existsSync(path.join(BACKUP_DIR, '.git'))) {
      run(`git init -b ${BACKUP_BRANCH}`, { cwd: BACKUP_DIR });
      run(`git remote add origin ${GITHUB_REMOTE}`, { cwd: BACKUP_DIR });
    }
  }

  const client = await POOL.connect();
  let backup;

  try {
    const [
      rUsers, rSubs, rAdminUsers, rAffiliates, rRecoveryKits,
      rTransactions, rCredentialClaims, rPasswordResetTokens, rEmailVerifyTokens,
      rAffiliateLinks, rAffiliateLinkDiscounts, rPayoutRequests,
      rPayoutConfig, rPlans, rPayments, rTaxTransactions,
      rAdminAuditLog, rAuditLogs,
    ] = await Promise.all([
      exportOne(client, 'users',
        `id, email, account_number, is_active,
         totp_enabled, is_admin, is_affiliate,
         lockout_until, failed_attempts,
         trial_ends_at, created_at, updated_at, last_login,
         stripe_customer_id, plisio_customer_id`),
      exportSubscriptions(client),
      exportOne(client, 'admin_users',
        `id, username, role, is_active, last_login, created_at, updated_at`),
      exportOne(client, 'affiliates',
        `id, username, status, user_id, created_at, suspended_at`),
      exportOne(client, 'recovery_kits',
        `id, user_id, kit_hash, created_at, used_at, revoked_at, last_shown_at, is_active`),
      exportOne(client, 'transactions',
        `id, affiliate_id, type, amount_cents, description, created_at, paid_out_at, payout_request_id`),
      exportOne(client, 'credential_claims',
        `id, customer_id, claim_token_hash, expires_at, claimed_at, created_at`),
      exportOne(client, 'password_reset_tokens',
        `id, user_id, token_hash, expires_at, created_at`),
      exportOne(client, 'email_verify_tokens',
        `id, user_id, token_hash, expires_at, created_at`),
      exportOne(client, 'affiliate_links', 'id, affiliate_id, code, created_at'),
      exportOne(client, 'affiliate_link_discounts',
        `id, affiliate_link_id, discount_cents, created_at`),
      exportOne(client, 'payout_requests',
        `id, affiliate_id, amount_cents, status, requested_at, processed_at, processor_transaction_id, notes`),
      exportOne(client, 'payout_config',
        `id, key, value, description, created_at, updated_at, default_discount_cents`),
      exportOne(client, 'plans',
        `id, name, interval, amount_cents, currency, features, trial_days`),
      exportOne(client, 'payments',
        `id, user_id, subscription_id, amount_cents, currency, status, payment_method, payment_intent_id, invoice_url, created_at, referral_code, account_number`),
      exportOne(client, 'tax_transactions',
        `id, transaction_date, postal_code, country, state, base_charge_cents, tax_rate, tax_amount_cents, total_amount_cents, invoice_number, subscription_id, user_id, payment_id, created_at`),
      exportOne(client, 'admin_audit_log',
        `id, admin_user_id, action, target_type, target_id, details, created_at`),
      exportOne(client, 'audit_logs',
        `id, user_id, action, ip, metadata, created_at`),
    ]);

    // Merge results into a flat object keyed by table name
    backup = {
      timestamp,
      ...rUsers, ...rSubs, ...rAdminUsers, ...rAffiliates, ...rRecoveryKits,
      ...rTransactions, ...rCredentialClaims, ...rPasswordResetTokens, ...rEmailVerifyTokens,
      ...rAffiliateLinks, ...rAffiliateLinkDiscounts, ...rPayoutRequests,
      ...rPayoutConfig, ...rPlans, ...rPayments, ...rTaxTransactions,
      ...rAdminAuditLog, ...rAuditLogs,
    };

    const counts = Object.entries(backup)
      .filter(([k]) => k !== 'timestamp')
      .map(([k, v]) => `${k}=${v.count}`)
      .join(' ');
    log(`Exported: ${counts}`);

  } finally {
    client.release();
  }

  const dateStr = timestamp.slice(0, 10);
  const dailyPath  = path.join(BACKUP_DIR, `auth-full-${dateStr}.json`);
  const fullPath   = path.join(BACKUP_DIR, 'auth-full.json');
  const metaPath   = path.join(BACKUP_DIR, 'meta.json');

  fs.writeFileSync(fullPath,   JSON.stringify(backup, null, 2));
  fs.writeFileSync(dailyPath,  JSON.stringify(backup, null, 2));
  fs.writeFileSync(metaPath,   JSON.stringify({
    last_backup: timestamp,
    tables: Object.keys(backup).filter(k => k !== 'timestamp'),
  }, null, 2));

  // Commit
  const totalRows = Object.values(backup).reduce((s, t) => s + (t.count || 0), 0);
  run(`git add auth-full.json auth-full-${dateStr}.json meta.json`, { cwd: BACKUP_DIR });
  const { status } = require('child_process').spawnSync(
    'git', ['commit', '-m', `Backup ${timestamp} — ${totalRows} rows`], { cwd: BACKUP_DIR }
  );
  if (status === 0) {
    // Push in background — don't block on github.com connectivity
    require('child_process').exec(
      `git push origin ${BACKUP_BRANCH} &`,
      { cwd: BACKUP_DIR }
    );
    log('Pushed to KeepUsAlive', 'OK');
  } else {
    log('No changes to commit (data identical)');
  }

  // Prune — keep last 30 days
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const files = fs.readdirSync(BACKUP_DIR).filter(f => f.startsWith('auth-full-20') && f.endsWith('.json'));
  for (const f of files) {
    const date = f.replace('auth-full-', '').replace('.json', '');
    if (date < cutoff) {
      fs.unlinkSync(path.join(BACKUP_DIR, f));
      log(`Pruned: ${f}`);
    }
  }

  await POOL.end();
  log('Backup complete.', 'OK');
  process.exit(0);
}

function run(cmd, opts = {}) {
  try {
    return execSync(cmd, { stdio: 'inherit', ...opts }).toString().trim();
  } catch (e) {
    console.error('Command failed:', cmd);
    return null;
  }
}

main().catch(err => {
  console.error('Backup failed:', err);
  process.exit(1);
});
