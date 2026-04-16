const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const pool = new Pool({ connectionString: 'postgresql://ahoyvpn:ahoyvpn_secure_password@localhost:5432/ahoyvpn' });
async function fix() {
  const client = await pool.connect();
  try {
    // Delete the duplicate wrt9510@gmail.com account we created earlier
    const del = await client.query(`DELETE FROM users WHERE email = 'wrt9510@gmail.com' RETURNING id`);
    console.log('Deleted duplicate accounts:', del.rowCount);

    // Now fix account 67812107
    const passwordHash = await bcrypt.hash('TempPass123!', 10);
    const r = await client.query(`
      UPDATE users
      SET email = 'wrt9510@gmail.com',
          password_hash = $1,
          is_active = true,
          updated_at = NOW()
      WHERE account_number = '67812107'
      RETURNING id, email, account_number, is_active, is_admin
    `, [passwordHash]);
    console.log('Fixed:', JSON.stringify(r.rows[0]));
  } catch (err) { console.error(err.message); }
  finally { client.release(); await pool.end(); }
}
fix();
