const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const pool = new Pool({ connectionString: 'postgresql://ahoyvpn:ahoyvpn_secure_password@localhost:5432/ahoyvpn' });

async function createUser() {
  const client = await pool.connect();
  try {
    // Check if user exists
    const existing = await client.query(`SELECT id FROM users WHERE email = $1`, ['wrt9510@gmail.com']);
    if (existing.rows.length > 0) {
      console.log('User already exists. Resetting password...');
      const passwordHash = await bcrypt.hash('TempPass123!', 10);
      await client.query(`UPDATE users SET password_hash = $1 WHERE email = 'wrt9510@gmail.com'`, [passwordHash]);
      console.log('Password reset done.');
      return;
    }

    // Create the user
    const passwordHash = await bcrypt.hash('TempPass123!', 10);
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 7);

    const r = await client.query(`
      INSERT INTO users (email, password_hash, is_active, trial_ends_at, created_at, updated_at, email_verified, is_admin)
      VALUES ($1, $2, true, $3, NOW(), NOW(), true, true)
      RETURNING id, email, is_active, is_admin
    `, ['wrt9510@gmail.com', passwordHash, trialEndsAt]);

    console.log('Account created:', JSON.stringify(r.rows[0]));
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}
createUser();
