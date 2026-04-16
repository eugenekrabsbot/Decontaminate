// Check payout_config rows for minimum_payout_cents and default_discount_cents
require('fs').readFileSync('/home/ahoy/BackEnd/.env', 'utf8')
  .split('\n')
  .forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) process.env[parts[0].trim()] = parts.slice(1).join('=').trim();
  });

const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function check() {
  const client = await pool.connect();
  try {
    const r = await client.query(
      "SELECT key, value, default_discount_cents FROM payout_config WHERE key IN ('minimum_payout_cents', 'default_discount_cents')"
    );
    console.log('Rows:', JSON.stringify(r.rows, null, 2));
  } finally {
    client.release();
    await pool.end();
  }
}

check().catch(e => { console.error('Error:', e.message); process.exit(1); });
