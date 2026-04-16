const { Pool } = require('pg');
const argon2 = require('argon2');

const pool = new Pool({
  connectionString: 'postgresql://ahoyvpn:ahoyvpn_secure_password@localhost:5432/ahoyvpn',
});

async function check() {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT username, password_hash FROM affiliates WHERE username = $1',
      ['Testo']
    );
    console.log('Affiliate:', JSON.stringify(result.rows[0]));

    if (result.rows.length > 0) {
      const passwordHash = result.rows[0].password_hash;
      const isValid = await argon2.verify(passwordHash, 'TempPass123!');
      console.log('Password valid:', isValid);
    }
  } catch (err) {
    console.error(err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

check();
