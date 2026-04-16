const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://ahoyvpn:ahoyvpn_secure_password@localhost:5432/ahoyvpn' });
async function check() {
  const client = await pool.connect();
  try {
    const r = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'referrals' ORDER BY ordinal_position`);
    console.log('referrals columns:', r.rows.map(x=>x.column_name).join(', '));
    
    const t = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'affiliates' ORDER BY ordinal_position`);
    console.log('affiliates columns:', t.rows.map(x=>x.column_name).join(', '));
  } catch (err) { console.error(err.message); }
  finally { client.release(); await pool.end(); }
}
check();
