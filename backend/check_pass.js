const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://ahoyvpn:ahoyvpn_secure_password@localhost:5432/ahoyvpn' });
async function check() {
  const client = await pool.connect();
  try {
    const r = await client.query(`SELECT id, account_number, password_hash, numeric_password_hash, is_active, failed_attempts, lockout_until FROM users WHERE account_number = '67812107'`);
    if (r.rows.length === 0) { console.log('Not found'); return; }
    const u = r.rows[0];
    console.log('password_hash starts with:', u.password_hash ? u.password_hash.substring(0, 10) : 'NULL');
    console.log('numeric_password_hash starts with:', u.numeric_password_hash ? u.numeric_password_hash.substring(0, 10) : 'NULL');
    console.log('is_active:', u.is_active);
    console.log('failed_attempts:', u.failed_attempts);
    console.log('lockout_until:', u.lockout_until);
  } catch (err) { console.error(err.message); }
  finally { client.release(); await pool.end(); }
}
check();
