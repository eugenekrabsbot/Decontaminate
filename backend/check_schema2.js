const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://ahoyvpn:ahoyvpn_secure_password@localhost:5432/ahoyvpn' });
async function check() {
  const client = await pool.connect();
  try {
    const t = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'affiliates' ORDER BY ordinal_position`);
    console.log('affiliates columns:', t.rows.map(r=>r.column_name).join(', '));
    
    const pc = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'promo_codes' ORDER BY ordinal_position`);
    console.log('promo_codes columns:', pc.rows.map(r=>r.column_name).join(', '));
    
    const a = await client.query(`SELECT id, username FROM affiliates LIMIT 3`);
    a.rows.forEach(row => console.log('Affiliate:', JSON.stringify(row)));
  } catch (err) { console.error(err.message); } 
  finally { client.release(); await pool.end(); }
}
check();
