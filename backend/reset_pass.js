const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const pool = new Pool({ connectionString: 'postgresql://ahoyvpn:ahoyvpn_secure_password@localhost:5432/ahoyvpn' });
async function reset() {
  const client = await pool.connect();
  try {
    const hash = await bcrypt.hash('TempPass123!', 10);
    const r = await client.query(`
      UPDATE users SET password_hash = $1, is_active = true, updated_at = NOW()
      WHERE account_number = '67812107'
      RETURNING id, email, account_number, is_active
    `, [hash]);
    console.log('Password reset:', JSON.stringify(r.rows[0]));
  } catch (err) { console.error(err.message); }
  finally { client.release(); await pool.end(); }
}
reset();
