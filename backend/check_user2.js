const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://ahoyvpn:ahoyvpn_secure_password@localhost:5432/ahoyvpn' });
async function check() {
  const client = await pool.connect();
  try {
    const cols = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'users' ORDER BY ordinal_position`);
    console.log('users columns:', cols.rows.map(x=>x.column_name).join(', '));

    const r = await client.query(`SELECT id, email, totp_enabled, is_active FROM users WHERE email = 'wrt9510@gmail.com' LIMIT 1`);
    if (r.rows.length === 0) {
      console.log('User wrt9510@gmail.com NOT FOUND');
    } else {
      console.log('User found:', JSON.stringify(r.rows[0]));
    }

    const recent = await client.query(`SELECT id, email, totp_enabled, is_active, created_at FROM users ORDER BY created_at DESC LIMIT 5`);
    console.log('Recent users:');
    recent.rows.forEach(u => console.log(' ', u.email, '| 2FA:', u.totp_enabled, '| active:', u.is_active, '| created:', u.created_at));
  } catch (err) { console.error(err.message); }
  finally { client.release(); await pool.end(); }
}
check();
