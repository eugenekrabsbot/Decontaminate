const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('crypto');
const pool = new Pool({ connectionString: 'postgresql://ahoyvpn:ahoyvpn_secure_password@localhost:5432/ahoyvpn' });

async function testRegister() {
  const client = await pool.connect();
  try {
    // Check if test email already exists
    const existing = await client.query(`SELECT id FROM users WHERE email = $1`, ['logintest@test.com']);
    if (existing.rows.length > 0) {
      console.log('Test user exists, deleting...');
      await client.query(`DELETE FROM users WHERE email = 'logintest@test.com'`);
    }

    // Create a test user directly
    const passwordHash = await bcrypt.hash('testpassword123', 10);
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 7);

    const r = await client.query(`
      INSERT INTO users (email, password_hash, is_active, trial_ends_at, created_at, updated_at, email_verified)
      VALUES ($1, $2, true, $3, NOW(), NOW(), true)
      RETURNING id, email, is_active, trial_ends_at
    `, ['logintest@test.com', passwordHash, trialEndsAt]);

    console.log('Test user created:', JSON.stringify(r.rows[0]));

    // Verify password works
    const verify = await client.query(`SELECT password_hash FROM users WHERE email = $1`, ['logintest@test.com']);
    const match = await bcrypt.compare('testpassword123', verify.rows[0].password_hash);
    console.log('Password verify:', match ? 'SUCCESS' : 'FAILED');

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}
testRegister();
