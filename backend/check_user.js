const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://ahoyvpn:ahoyvpn_secure_password@localhost:5432/ahoyvpn' });
async function check() {
  const client = await pool.connect();
  try {
    const r = await client.query(`SELECT id, email, status, totp_enabled, is_active FROM users WHERE email = 'wrt9510@gmail.com' LIMIT 1`);
    if (r.rows.length === 0) {
      console.log('User wrt9510@gmail.com NOT FOUND');
    } else {
      console.log('User found:', JSON.stringify(r.rows[0]));
    }
    const recent = await client.query(`SELECT id, email, status, totp_enabled, is_active, created_at FROM users ORDER BY created_at DESC LIMIT 5`);
    console.log('Recent users:');
    recent.rows.forEach(u => console.log(' ', u.email, '| status:', u.status, '| 2FA:', u.totp_enabled, '| active:', u.is_active));
  } catch (err) { console.error(err.message); }
  finally { client.release(); await pool.end(); }
}
check();
