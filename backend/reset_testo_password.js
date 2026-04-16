const { Pool } = require('pg');
const argon2 = require('argon2');

const pool = new Pool({
  connectionString: 'postgresql://ahoyvpn:ahoyvpn_secure_password@localhost:5432/ahoyvpn',
});

async function reset() {
  const client = await pool.connect();
  try {
    const password = 'TempPass123!';
    const hash = await argon2.hash(password);

    const result = await client.query(
      'UPDATE affiliates SET password_hash = $1 WHERE username = $2 RETURNING username',
      [hash, 'Testo']
    );

    if (result.rows.length > 0) {
      console.log('Password reset for affiliate:', result.rows[0].username);
      console.log('New password:', password);
    } else {
      console.log('Affiliate Testo not found');
    }
  } catch (err) {
    console.error(err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

reset();
