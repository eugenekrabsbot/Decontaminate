#!/usr/bin/env node
const { Pool } = require('pg');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const POOL = new Pool({ connectionString: 'postgresql://ahoyvpn:ahoyvpn_secure_password@localhost:5432/ahoyvpn' });
const BACKUP_DIR = '/home/ahoy/backups';
const DATE_STR = new Date().toISOString().slice(0,10);
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0,19);

function run(cmd) {
  try { execSync(cmd, { cwd: BACKUP_DIR, stdio: 'pipe' }); return true; }
  catch (e) { return false; }
}

async function main() {
  console.log('[' + new Date().toISOString() + '] Backup starting...');

  const [users, subs] = await Promise.all([
    POOL.query('SELECT id, email, account_number, is_active, totp_enabled, is_admin, is_affiliate, lockout_until, failed_attempts, trial_ends_at, created_at, updated_at, last_login FROM users ORDER BY created_at DESC'),
    POOL.query('SELECT s.id, s.user_id, s.status, s.plan_id, s.current_period_start, s.current_period_end, s.cancel_at_period_end, s.created_at, u.email, u.account_number FROM subscriptions s JOIN users u ON s.user_id = u.id ORDER BY s.created_at DESC')
  ]);

  const data = { timestamp: TIMESTAMP, users: users.rows, subscriptions: subs.rows };
  fs.writeFileSync(path.join(BACKUP_DIR, 'users-full.json'), JSON.stringify(data, null, 2));
  fs.writeFileSync(path.join(BACKUP_DIR, 'users-' + DATE_STR + '.json'), JSON.stringify(data, null, 2));
  fs.writeFileSync(path.join(BACKUP_DIR, 'meta.json'), JSON.stringify({ last_backup: TIMESTAMP, users: users.rows.length }, null, 2));

  console.log('[' + new Date().toISOString() + '] Exported ' + users.rows.length + ' users, ' + subs.rows.length + ' subscriptions');

  // Prune old daily files — keep last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0,10);
  const files = fs.readdirSync(BACKUP_DIR).filter(f => /^users-\d{4}-\d{2}-\d{2}\.json$/.test(f) && f !== 'users-full.json');
  for (const f of files) {
    const d = f.replace('users-','').replace('.json','');
    if (d < sevenDaysAgo) {
      fs.unlinkSync(path.join(BACKUP_DIR, f));
      run('git rm -q -f ' + f);
      console.log('Pruned: ' + f);
    }
  }

  run('git add users-full.json users-' + DATE_STR + '.json meta.json');
  const { status } = require('child_process').spawnSync('git', ['commit', '-m', 'Backup ' + TIMESTAMP + ' — ' + users.rows.length + ' users, ' + subs.rows.length + ' subscriptions'], { cwd: BACKUP_DIR });

  if (status === 0) {
    run('git push origin main');
    console.log('[' + new Date().toISOString() + '] Pushed to GitHub');
  } else {
    console.log('[' + new Date().toISOString() + '] No changes to commit');
  }

  await POOL.end();
  process.exit(0);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
