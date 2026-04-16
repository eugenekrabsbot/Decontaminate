const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://ahoyvpn:ahoyvpn_secure_password@localhost:5432/ahoyvpn' });
async function check() {
  const client = await pool.connect();
  try {
    const r = await client.query(`SELECT id, email, account_number, is_active, totp_enabled, is_admin FROM users WHERE account_number = $1 LIMIT 1`, ['67812107']);
    if (r.rows.length === 0) {
      console.log('Account 67812107 NOT FOUND');
    } else {
      console.log('Account found:', JSON.stringify(r.rows[0]));
    }
  } catch (err) { console.error(err.message); }
  finally { client.release(); await pool.end(); }
}
check();
