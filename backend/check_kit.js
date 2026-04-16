const { Pool } = require('pg');
const crypto = require('crypto');
const pool = new Pool({ connectionString: 'postgresql://ahoyvpn:ahoyvpn_secure_password@localhost:5432/ahoyvpn' });

async function check() {
  const client = await pool.connect();
  try {
    // Get user for account 67812107
    const user = await client.query(`SELECT id, account_number FROM users WHERE account_number = '67812107'`);
    if (user.rows.length === 0) { console.log('User not found'); return; }
    console.log('User:', JSON.stringify(user.rows[0]));

    // Check recovery kits
    const kits = await client.query(`SELECT id, is_active, used_at, revoked_at, created_at FROM recovery_kits WHERE user_id = $1`, [user.rows[0].id]);
    console.log('Recovery kits found:', kits.rows.length);
    kits.rows.forEach(k => console.log(' Kit:', JSON.stringify(k)));
  } catch (err) { console.error(err.message); }
  finally { client.release(); await pool.end(); }
}
check();
