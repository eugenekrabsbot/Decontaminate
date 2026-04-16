const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://ahoyvpn:ahoyvpn_secure_password@localhost:5432/ahoyvpn' });
async function check() {
  const client = await pool.connect();
  try {
    // Get affiliate username and code
    const r = await client.query(`SELECT id, username, code FROM affiliates LIMIT 3`);
    r.rows.forEach(row => console.log('Affiliate:', JSON.stringify(row)));
    
    // Get promo codes
    const pc = await client.query(`SELECT id, code, affiliate_id, status, created_at FROM promo_codes LIMIT 5`);
    pc.rows.forEach(row => console.log('PromoCode:', JSON.stringify(row)));
  } catch (err) { console.error(err.message); } 
  finally { client.release(); await pool.end(); }
}
check();
