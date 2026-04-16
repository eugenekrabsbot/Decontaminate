const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://ahoyvpn:ahoyvpn_secure_password@localhost:5432/ahoyvpn' });
async function check() {
  const client = await pool.connect();
  try {
    const t = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'transactions' ORDER BY ordinal_position`);
    console.log('transactions columns:', t.rows.map(x=>x.column_name).join(', '));
    
    const s = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'subscriptions' ORDER BY ordinal_position`);
    console.log('subscriptions columns:', s.rows.map(x=>x.column_name).join(', '));
  } catch (err) { console.error(err.message); }
  finally { client.release(); await pool.end(); }
}
check();
