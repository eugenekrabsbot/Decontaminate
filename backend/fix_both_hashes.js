const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const argon2 = require('argon2');
const pool = new Pool({ connectionString: 'postgresql://ahoyvpn:ahoyvpn_secure_password@localhost:5432/ahoyvpn' });
async function fix() {
  const client = await pool.connect();
  try {
    const newPassword = 'TempPass123!';
    const bcryptHash = await bcrypt.hash(newPassword, 10);
    const argonHash = await argon2.hash(newPassword);

    const r = await client.query(`
      UPDATE users
      SET password_hash = $1,
          numeric_password_hash = $2,
          is_active = true,
          updated_at = NOW()
      WHERE account_number = '67812107'
      RETURNING id, account_number, is_active
    `, [bcryptHash, argonHash]);
    console.log('Both hashes updated:', JSON.stringify(r.rows[0]));
  } catch (err) { console.error(err.message); }
  finally { client.release(); await pool.end(); }
}
fix();
