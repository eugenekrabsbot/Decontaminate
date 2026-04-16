const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://ahoyvpn:ahoyvpn_secure_password@localhost:5432/ahoyvpn' });
async function check() {
  const client = await pool.connect();
  try {
    const cols = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'affiliates' ORDER BY ordinal_position`);
    console.log('affiliates columns:', cols.rows.map(x=>x.column_name).join(', '));

    const refs = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'referrals' ORDER BY ordinal_position`);
    console.log('referrals columns:', refs.rows.map(x=>x.column_name).join(', '));

    const aff = await client.query(`SELECT id, username, status FROM affiliates LIMIT 1`);
    console.log('Sample affiliate:', JSON.stringify(aff.rows[0]));
  } catch (err) { console.error('ERR:', err.message); }
  finally { client.release(); await pool.end(); }
}
check();
