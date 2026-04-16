const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://ahoyvpn:ahoyvpn_secure_password@localhost:5432/ahoyvpn' });

async function addStatus() {
  const client = await pool.connect();
  try {
    console.log('Adding status column to promo_codes table...');
    await client.query(`ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active'`);
    console.log('Status column added successfully!');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

addStatus().catch(console.error);
