const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://ahoyvpn:ahoyvpn_secure_password@localhost:5432/ahoyvpn' });
async function check() {
  const client = await pool.connect();
  try {
    const result = await client.query("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'promo_codes') as table_exists");
    console.log('Table exists:', result.rows[0].table_exists);
    if (result.rows[0].table_exists) {
      const columns = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'promo_codes' ORDER BY ordinal_position");
      console.log('Columns:', columns.rows.map(c => c.column_name).join(', '));
    }
  } catch (err) { console.error(err); } finally { client.release(); await pool.end(); }
}
check();
