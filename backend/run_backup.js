const { Pool } = require('pg');
const { execSync } = require('child_process');
const pool = new Pool({ connectionString: 'postgresql://ahoyvpn:ahoyvpn_secure_password@localhost:5432/ahoyvpn' });

async function main() {
  const client = await pool.connect();
  try {
    // Drop old table
    await client.query('DROP TABLE IF EXISTS user_backups');
    console.log('Dropped old user_backups table');

    // Create new table with JSONB
    await client.query(`
      CREATE TABLE user_backups (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL,
        user_data JSONB NOT NULL,
        backup_reason TEXT,
        performed_by TEXT,
        performed_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
        notes TEXT
      )
    `);
    console.log('Created user_backups table (JSONB snapshot)');
  } finally {
    client.release();
  }
  await pool.end();
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
