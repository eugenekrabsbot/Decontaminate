/**
 * safe_user_reset.js
 * Backup all user records before any change, with git commit snapshot.
 *
 * Usage:
 *   node safe_user_reset.js --action=backup
 *   node safe_user_reset.js --action=restore --identifier=user@example.com
 *   node safe_user_reset.js --action=list --identifier=user@example.com
 */

const { Pool } = require('pg');
const { execSync } = require('child_process');

const pool = new Pool({
  connectionString: 'postgresql://ahoyvpn:ahoyvpn_secure_password@localhost:5432/ahoyvpn',
});

function gitCommit(message) {
  try {
    execSync('cd /home/ahoy/BackEnd && git add -A && git commit -m ' + JSON.stringify(message), { stdio: 'pipe' });
    console.log('✅ Git commit done');
  } catch (e) {
    console.log('⚠️  Git commit failed (no changes)');
  }
}

async function ensureBackupsTable() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_backups (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL,
        user_data JSONB NOT NULL,
        backup_reason TEXT,
        performed_by TEXT,
        performed_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
        notes TEXT
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_user_backups_user_id ON user_backups(user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_user_backups_performed_at ON user_backups(performed_at)`);
    console.log('✅ user_backups table ready');
  } finally {
    client.release();
  }
}

async function backupAllUsers(reason, performedBy, notes = '') {
  const client = await pool.connect();
  try {
    const users = await client.query(`SELECT * FROM users`);
    for (const u of users.rows) {
      // Remove internal UUID and timestamp fields from the snapshot
      const { id, ...snapshot } = u;
      await client.query(`
        INSERT INTO user_backups (user_id, user_data, backup_reason, performed_by, notes)
        VALUES ($1, $2, $3, $4, $5)
      `, [id, JSON.stringify(snapshot), reason, performedBy, notes]);
    }
    console.log(`✅ Backed up ${users.rows.length} user records`);
    return users.rows.length;
  } finally {
    client.release();
  }
}

async function restoreLatestBackup(identifier) {
  const client = await pool.connect();
  try {
    const userResult = await client.query(
      `SELECT id FROM users WHERE email = $1 OR account_number = $1 LIMIT 1`,
      [identifier]
    );
    if (userResult.rows.length === 0) { console.log('❌ User not found'); return false; }
    const userId = userResult.rows[0].id;

    const backup = await client.query(`
      SELECT user_data FROM user_backups
      WHERE user_id = $1
      ORDER BY performed_at DESC
      LIMIT 1
    `, [userId]);

    if (backup.rows.length === 0) { console.log('❌ No backup found'); return false; }

    const data = backup.rows[0].user_data;
    const cols = Object.keys(data);
    const sets = cols.map((c, i) => `${c} = $${i + 2}`).join(', ');

    const values = [userId, ...Object.values(data)];
    await client.query(
      `UPDATE users SET ${sets}, updated_at = NOW() WHERE id = $1`,
      values
    );
    console.log(`✅ Restored user ${identifier} from backup`);
    return true;
  } finally {
    client.release();
  }
}

async function listBackups(identifier) {
  const client = await pool.connect();
  try {
    const userResult = await client.query(
      `SELECT id FROM users WHERE email = $1 OR account_number = $1 LIMIT 1`,
      [identifier]
    );
    if (userResult.rows.length === 0) { console.log('❌ User not found'); return; }
    const userId = userResult.rows[0].id;

    const result = await client.query(`
      SELECT performed_at, performed_by, backup_reason, notes
      FROM user_backups
      WHERE user_id = $1
      ORDER BY performed_at DESC
      LIMIT 10
    `, [userId]);

    console.log(`Backups for ${identifier}:`);
    result.rows.forEach(b =>
      console.log(`  ${b.performed_at} | ${b.backup_reason} | by ${b.performed_by} | ${b.notes || ''}`)
    );
  } finally {
    client.release();
  }
}

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, ...v] = a.replace('--', '').split('=');
  return [k, v.join('=')];
}));

(async () => {
  const { action, identifier } = args;

  if (!action) {
    console.log('Usage: node safe_user_reset.js --action=backup|restore|list [--identifier=x]');
    process.exit(1);
  }

  await ensureBackupsTable();

  if (action === 'backup') {
    gitCommit('pre-change user backup');
    await backupAllUsers('pre_change', 'agent_krabs', 'Routine pre-change snapshot');

  } else if (action === 'restore') {
    if (!identifier) { console.log('❌ Need --identifier=<email or account>'); process.exit(1); }
    await restoreLatestBackup(identifier);

  } else if (action === 'list') {
    if (!identifier) { console.log('❌ Need --identifier=<email or account>'); process.exit(1); }
    await listBackups(identifier);
  }

  await pool.end();
})();
