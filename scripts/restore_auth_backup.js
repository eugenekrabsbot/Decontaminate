#!/usr/bin/env node
/**
 * restore_auth_backup.js
 * Selective table restore from KeepUsAlive backup repo.
 *
 * Usage:
 *   node restore_auth_backup.js --list                        # Show available backups
 *   node restore_auth_backup.js --show <date>                # Show tables/row counts in a backup
 *   node restore_auth_backup.js --restore <date> --tables admin_users,affiliates,users
 *   node restore_auth_backup.js --verify <date>              # Compare backup row counts to live DB
 *
 * Safety:
 *   - Only restores specified tables (not a blind full restore)
 *   - Backs up CURRENT state to a timestamped JSON before overwriting
 *   - Requires --force flag for actual restore (dry-run is default)
 *
 * Examples:
 *   node restore_auth_backup.js --list
 *   node restore_auth_backup.js --verify 2026-04-16
 *   node restore_auth_backup.js --restore 2026-04-16 --tables admin_users,affiliates --force
 */

const { Pool } = require('pg');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const POOL = new Pool({
  connectionString: 'postgresql://ahoyvpn:ahoyvpn_secure_password@localhost:5432/ahoyvpn',
});

const BACKUP_DIR = '/home/ahoy/backups';


const ALL_TABLES = [
  'admin_users', 'affiliates', 'users', 'subscriptions',
  'recovery_kits', 'transactions', 'credential_claims',
  'password_reset_tokens', 'email_verify_tokens',
  'affiliate_links', 'affiliate_link_discounts', 'payout_requests',
  'payout_config', 'plans', 'payments', 'tax_transactions',
  'admin_audit_log', 'audit_logs',
];

function log(msg, type = 'INFO') {
  const ts = new Date().toISOString();
  const prefix = type === 'ERROR' ? '❌' : type === 'WARN' ? '⚠️' : type === 'OK' ? '✅' : '  ';
  console.log(`${prefix} [${ts}] ${msg}`);
}

function run(cmd, opts = {}) {
  try {
    const r = execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'], ...opts });
    return { out: r.toString().trim(), code: 0 };
  } catch (e) {
    return { out: e.stdout?.toString().trim() || '', err: e.stderr?.toString().trim() || '', code: e.status };
  }
}

// ─── Git pull latest ──────────────────────────────────────────────────────────

// ─── List available backups ────────────────────────────────────────────────────

function listBackups() {
  log('(Run "git pull origin main" in /home/ahoy/backups to update backups)', 'INFO');
  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('auth-full-20') && f.endsWith('.json'))
    .sort()
    .reverse();
  if (files.length === 0) {
    log('No auth-full backups found', 'WARN');
    return;
  }
  console.log('\n📦 Available backups:');
  for (const f of files) {
    const stat = fs.statSync(path.join(BACKUP_DIR, f));
    const rows = JSON.parse(fs.readFileSync(path.join(BACKUP_DIR, f), 'utf8'));
    const totalRows = Object.values(rows).reduce((s, t) => s + (t.count || 0), 0);
    const date = f.replace('auth-full-', '').replace('.json', '');
    const tables = Object.keys(rows).filter(k => k !== 'timestamp').join(', ');
    console.log(`  ${date}  (${(stat.size / 1024).toFixed(1)} KB, ${totalRows} rows)`);
  }
}

// ─── Show backup contents ──────────────────────────────────────────────────────

function showBackup(dateStr) {
  const file = path.join(BACKUP_DIR, `auth-full-${dateStr}.json`);
  if (!fs.existsSync(file)) {
    log(`Backup file not found: ${file}`, 'ERROR');
    return null;
  }
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  console.log(`\n📋 Backup: ${dateStr}  (${fs.statSync(file).size} bytes)`);
  console.log('─'.repeat(50));
  for (const [table, val] of Object.entries(data)) {
    if (table === 'timestamp') { console.log(`timestamp: ${val}`); continue; }
    console.log(`  ${table}: ${val.count || 0} rows${val.error ? ` [ERROR: ${val.error}]` : ''}`);
  }
  return data;
}

// ─── Pre-restore snapshot ──────────────────────────────────────────────────────

async function snapshotTables(tables, label) {
  log(`Taking pre-restore snapshot: ${label}`);
  const snapDir = path.join(BACKUP_DIR, 'pre_restore');
  if (!fs.existsSync(snapDir)) fs.mkdirSync(snapDir, { recursive: true });
  const snapFile = path.join(snapDir, `pre-${label}.json`);
  const snap = {};
  const client = await POOL.connect();
  try {
    for (const tbl of tables) {
      try {
        const r = await client.query(`SELECT * FROM ${tbl}`);
        snap[tbl] = { count: r.rowCount, rows: r.rows };
        log(`  ${tbl}: ${r.rowCount} rows snapshotted`);
      } catch (err) {
        snap[tbl] = { count: 0, rows: [], error: err.message };
        log(`  ${tbl}: snapshot failed — ${err.message}`, 'WARN');
      }
    }
  } finally { client.release(); }
  fs.writeFileSync(snapFile, JSON.stringify({ timestamp: new Date().toISOString(), ...snap }, null, 2));
  log(`Snapshot saved: ${snapFile}`);
  return snapFile;
}

// ─── Verify backup against live DB ───────────────────────────────────────────

async function verifyBackup(dateStr) {
  const data = showBackup(dateStr);
  if (!data) return;
  const client = await POOL.connect();
  console.log('\n🔍 Live DB vs Backup comparison:');
  console.log('─'.repeat(50));
  try {
    for (const [table, val] of Object.entries(data)) {
      if (table === 'timestamp') continue;
      try {
        const live = await client.query(`SELECT COUNT(*) FROM ${table}`);
        const liveCount = parseInt(live.rows[0].count);
        const backupCount = val.count || 0;
        const diff = backupCount - liveCount;
        const icon = diff === 0 ? '✅' : diff > 0 ? '📈' : '📉';
        console.log(`  ${icon} ${table}: live=${liveCount} backup=${backupCount} (diff=${diff >= 0 ? '+' : ''}${diff})`);
      } catch (err) {
        console.log(`  ❌ ${table}: cannot verify — ${err.message}`);
      }
    }
  } finally { client.release(); }
}

// ─── Restore tables ───────────────────────────────────────────────────────────

async function restoreTables(dateStr, tables, force) {
  if (!force) {
    log('DRY RUN — use --force to actually restore', 'WARN');
    log(`Would restore tables: ${tables.join(', ')} from ${dateStr}`, 'WARN');
    return;
  }

  const file = path.join(BACKUP_DIR, `auth-full-${dateStr}.json`);
  if (!fs.existsSync(file)) {
    log(`Backup not found: ${file}`, 'ERROR');
    return;
  }

  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

  const client = await POOL.connect();
  try {
    for (const tbl of tables) {
      if (!data[tbl]) {
        log(`Table '${tbl}' not in backup — skipping`, 'WARN');
        continue;
      }
      if (data[tbl].error) {
        log(`${tbl}: backup has error — ${data[tbl].error} — skipping`, 'WARN');
        continue;
      }

      log(`Restoring ${tbl}...`);
      const snapshotFile = await snapshotTables([tbl], `${tbl}-${ts}`);

      try {
        // Get column list from backup
        const cols = data[tbl].rows.length > 0 ? Object.keys(data[tbl].rows[0]) : [];
        if (cols.length === 0) {
          log(`  No data or columns for ${tbl} — skipping truncate+insert`, 'WARN');
          continue;
        }

        // Truncate
        await client.query(`TRUNCATE TABLE ${tbl} RESTART IDENTITY CASCADE`);
        log(`  Truncated ${tbl}`);

        // Insert rows in batches
        const rows = data[tbl].rows;
        if (rows.length > 0) {
          const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
          const colNames = cols.join(', ');
          let inserted = 0;
          const batchSize = 100;
          for (let i = 0; i < rows.length; i += batchSize) {
            const batch = rows.slice(i, i + batchSize);
            const values = batch.map(row => cols.map(c => row[c]));
            for (const vals of values) {
              await client.query(
                `INSERT INTO ${tbl} (${colNames}) VALUES (${placeholders})`,
                vals
              );
              inserted++;
            }
          }
          log(`  Inserted ${inserted} rows into ${tbl}`);
        }

        // Verify
        const verify = await client.query(`SELECT COUNT(*) FROM ${tbl}`);
        log(`  Verified: ${tbl} now has ${verify.rows[0].count} rows`, 'OK');

      } catch (err) {
        log(`  Restore failed for ${tbl}: ${err.message}`, 'ERROR');
        log(`  Pre-restore snapshot available: ${snapshotFile}`, 'WARN');
      }
    }
  } finally {
    await client.release();
    await POOL.end();
  }
}

// ─── CLI ───────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

function getArg(flag) {
  const idx = args.indexOf(flag);
  return idx >= 0 ? args[idx + 1] : null;
}

const action  = args[0];
const date    = getArg('--date') || getArg(args[1]) || null;
const tables  = getArg('--tables') ? getArg('--tables').split(',') : null;
const force   = args.includes('--force');
const listOnly = action === '--list';
const verify  = action === '--verify';
const restore = action === '--restore';

if (listOnly) {
  listBackups();
  process.exit(0);
}

if (verify) {
  const d = date || (() => {
    const files = fs.readdirSync(BACKUP_DIR).filter(f => f.startsWith('auth-full-20') && f.endsWith('.json')).sort().reverse();
    return files[0]?.replace('auth-full-', '').replace('.json', '') || null;
  })();
  if (!d) { log('No backup found', 'ERROR'); process.exit(1); }
  verifyBackup(d).then(() => process.exit(0));
  return;
}

if (restore) {
  if (!date) { log('--date <YYYY-MM-DD> required', 'ERROR'); process.exit(1); }
  if (!tables) { log('--tables <table1,table2,...> required', 'ERROR'); process.exit(1); }
  log(`RESTORE REQUEST — date=${date} tables=${tables.join(',')} force=${force}`, force ? 'WARN' : 'INFO');
  if (!force) {
    console.log('\n⚠️  DRY RUN — no changes will be made. Add --force to restore.\n');
  }
  restoreTables(date, tables, force).then(() => process.exit(0));
  return;
}

console.log(`
restore_auth_backup.js — Selective table restore from KeepUsAlive backup

Usage:
  node restore_auth_backup.js --list                       # List available backups
  node restore_auth_backup.js --verify [--date YYYY-MM-DD] # Compare backup vs live DB
  node restore_auth_backup.js --restore --date YYYY-MM-DD --tables table1,table2 [--force]

Options:
  --force   Required to actually write to DB (otherwise dry-run)

Examples:
  node restore_auth_backup.js --list
  node restore_auth_backup.js --verify
  node restore_auth_backup.js --restore --date 2026-04-16 --tables admin_users,affiliates --force

Safety:
  - Pre-restore snapshot taken automatically before any table is modified
  - Snapshots saved to ${BACKUP_DIR}/pre_restore/
`);
process.exit(0);
